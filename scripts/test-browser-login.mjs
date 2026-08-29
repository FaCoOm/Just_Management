async function run() {
  const versionRes = await fetch("http://127.0.0.1:9222/json/new", { method: "PUT" });
  const tab = await versionRes.json();
  console.log("Opened tab:", tab.id);

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
    if (msg.method === "Network.responseReceived") {
      const url = msg.params.response.url;
      if (url.includes("/api/one/") || url.includes("withone.ai") || url.includes("google.com")) {
        console.log("[Network Response]", msg.params.response.status, url.slice(0, 90));
      }
    }
    if (msg.method === "Runtime.consoleAPICalled") {
      console.log("[Console]", msg.params.type, msg.params.args.map((a) => a.value || a.description).join(" "));
    }
  });

  await new Promise((resolve) => ws.addEventListener("open", resolve));
  console.log("Connected to Chrome via CDP");

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");

  console.log("Navigating to tunnel Integrations page...");
  await send("Page.navigate", { url: "https://tions-theory-dividend-studios.trycloudflare.com/settings/integrations" });

  // Wait 4s for navigation and render
  await new Promise((r) => setTimeout(r, 4000));

  // Type operator password and submit
  await send("Runtime.evaluate", {
    expression: `
      (() => {
        const input = document.querySelector('input[type=password]');
        if (!input) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, 'XHXb4u4mfRHFq24L7Nbp');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        const submitBtn = document.querySelector('button[type=submit]');
        if (submitBtn) submitBtn.click();
      })()
    `,
  });

  // Wait 3s for authentication to complete
  await new Promise((r) => setTimeout(r, 3000));

  console.log("Clicking 'Connect Google Drive' button...");
  const clickConnect = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const driveBtn = buttons.find(b => b.innerText.includes('Connect Google Drive'));
        if (driveBtn) {
          driveBtn.click();
          return 'drive_button_clicked';
        }
        return 'drive_button_not_found';
      })()
    `,
    returnByValue: true,
  });
  console.log("Connect button click result:", clickConnect.result.value);

  // Wait 4s for AuthKit iframe / popup creation
  await new Promise((r) => setTimeout(r, 4000));

  // Inspect if iframe or AuthKit elements are present in DOM
  const authKitDom = await send("Runtime.evaluate", {
    expression: `
      (() => {
        const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.src);
        return { iframes };
      })()
    `,
    returnByValue: true,
  });
  console.log("\n=== AUTHKIT IFRAME IN DOM ===");
  console.log(JSON.stringify(authKitDom.result.value, null, 2));

  ws.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
