#!/usr/bin/env python3
import asyncio
import json
import os
import sys
import base64
import hashlib
import uuid
import websockets

HOST = os.environ.get("OBS_HOST", "localhost")
PORT = int(os.environ.get("OBS_PORT", "4455"))
PASSWORD = os.environ.get("OBS_PASSWORD", "")
WS_URL = f"ws://{HOST}:{PORT}"

def generate_auth(password: str, salt: str, challenge: str) -> str:
    secret = hashlib.sha256((password + salt).encode("utf-8")).digest()
    auth_data = (base64.b64encode(secret).decode("utf-8") + challenge).encode("utf-8")
    return base64.b64encode(hashlib.sha256(auth_data).digest()).decode("utf-8")

async def main():
    try:
        async with websockets.connect(WS_URL) as ws:
            # 1. Hello
            hello = json.loads(await ws.recv())
            auth_info = hello.get("d", {}).get("authentication")
            
            # 2. Identify
            identify = {
                "op": 1,
                "d": {
                    "rpcVersion": 1,
                    "eventSubscriptions": 33
                }
            }
            if auth_info:
                salt = auth_info["salt"]
                challenge = auth_info["challenge"]
                identify["d"]["authentication"] = generate_auth(PASSWORD, salt, challenge)
            
            await ws.send(json.dumps(identify))
            identified = json.loads(await ws.recv())
            if identified.get("op") != 2:
                print("❌ Autentikasi gagal.")
                return
            
            print("✅ Terhubung ke OBS.")
            
            # 3. CallVendorRequest (refresh)
            req_id = str(uuid.uuid4())[:8]
            payload = {
                "op": 6,
                "d": {
                    "requestId": req_id,
                    "requestType": "CallVendorRequest",
                    "requestData": {
                        "vendorName": "obs-browser",
                        "requestType": "refresh",
                        "requestData": {
                            "sourceName": "Gangsing Game"
                        }
                    }
                }
            }
            await ws.send(json.dumps(payload))
            while True:
                msg = json.loads(await ws.recv())
                if msg.get("op") == 7 and msg["d"].get("requestId") == req_id:
                    res = msg["d"].get("requestStatus", {})
                    if res.get("result"):
                        print(f"✅ Berhasil me-refresh browser source 'Gangsing Game' di OBS!")
                    else:
                        print(f"❌ Gagal refresh source: {res.get('comment')}")
                    break
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
