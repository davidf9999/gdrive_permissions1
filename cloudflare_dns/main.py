from fastapi import FastAPI, HTTPException
import httpx
import os
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI()

CF_BASE = "https://api.cloudflare.com/client/v4"

class Record(BaseModel):
    type: str
    name: str
    content: str
    ttl: int = 3600
    proxied: bool = False

class SubdomainPayload(BaseModel):
    root_domain: str
    subdomain: str
    records: List[Record]

async def create_record(client: httpx.AsyncClient, zone_id: str, record_data: Dict[str, Any]):
    CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not CLOUDFLARE_API_TOKEN:
        raise HTTPException(status_code=500, detail="CLOUDFLARE_API_TOKEN not set")

    resp = await client.post(
        f"{CF_BASE}/zones/{zone_id}/dns_records",
        headers={"Authorization": f"Bearer {CLOUDFLARE_API_TOKEN}", "Content-Type": "application/json"},
        json=record_data,
    )
    data = resp.json()
    if not data.get("success"):
        print(f"Cloudflare API Error: {data.get('errors')}") # For debugging
        raise HTTPException(status_code=500, detail=data.get("errors"))
    return data

@app.post("/dns/subdomain/apply")
async def apply_subdomain(payload: SubdomainPayload):
    # Ensure environment variables are set
    CLOUDFLARE_ZONE_ID = os.environ.get("CLOUDFLARE_ZONE_ID")
    if not CLOUDFLARE_ZONE_ID:
        raise HTTPException(status_code=500, detail="CLOUDFLARE_ZONE_ID not set")

    sub = payload.subdomain
    root = payload.root_domain
    records = payload.records

    fqdn_prefix = f"{sub}.{root}"

    to_create = []
    for rec in records:
        # If the name is '@', it refers to the subdomain itself (e.g., demo3.dfront1.com)
        # Otherwise, it's a sub-entry of the subdomain (e.g., www.demo3.dfront1.com)
        name = rec.name
        full_name = fqdn_prefix if name == "@" else f"{name}.{fqdn_prefix}"

        to_create.append({
            "type": rec.type,
            "name": full_name,
            "content": rec.content,
            "ttl": rec.ttl,
            "proxied": rec.proxied,
        })

    async with httpx.AsyncClient(timeout=10) as client:
        created_records = []
        for rec_data in to_create:
            try:
                result = await create_record(client, CLOUDFLARE_ZONE_ID, rec_data)
                created_records.append({"status": "success", "record": rec_data, "response": result})
            except HTTPException as e:
                created_records.append({"status": "failed", "record": rec_data, "error": e.detail})
                # Optionally, you might want to raise an error here if any single record failure should
                # cause the whole operation to fail. For now, we'll collect all results.

    # Check if any records failed to be created
    if any(res["status"] == "failed" for res in created_records):
        raise HTTPException(status_code=500, detail={"message": "Some records failed to create", "results": created_records})

    return {"status": "ok", "created": created_records}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok"}
