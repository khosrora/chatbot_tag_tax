(function () {
  'use strict';

  // ---- UUID helper (secure when possible) ----
  function safeUUID() {
    try {
      if (typeof window !== "undefined" && window.crypto) {
        if (typeof window.crypto.randomUUID === "function") {
          return window.crypto.randomUUID(); // modern browsers over HTTPS
        }
        if (typeof window.crypto.getRandomValues === "function") {
          const bytes = new Uint8Array(16);
          window.crypto.getRandomValues(bytes);
          // RFC 4122 v4
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
          return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
        }
      }
    } catch (_) { /* ignore */ }
    // Final non-crypto fallback
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  window.ChatbotWidget = {
    init: function (config = {}) {
      // Avoid double-mount
      if (document.getElementById("chatbot-widget")) return;

      const defaultColors = {
        primary: "#4DA8DA",
        secondary: "#f1f1f1",
        userMessage: "#dcf8c6",
        text: "#333333",
        background: "#ffffff",
      };

      const {
        apiUrl = 'https://work.avidflow.ir/webhook/b686d7df-1313-49b5-a5bc-d2b92575934a/chat',
        title = "chat with ai",
        botInitialMessage = "hi !! how i can help you ?",
        logoUrl = 'https://cm4-production-assets.s3.amazonaws.com/1757685045923-images.png',
        serviceTitle = 'ra agent bot',
      } = config || {};

      const colors = { ...defaultColors, ...(config.colors || {}) };

      if (!apiUrl) {
        console.error("ChatbotWidget Error: apiUrl is required.");
        return;
      }

      // Generate or load sessionId (resilient)
      const STORAGE_KEY = "chatbot-sessionId";
      let sessionId = null;
      try {
        sessionId = localStorage.getItem(STORAGE_KEY);
      } catch (_) { /* storage blocked */ }
      if (!sessionId) {
        sessionId = safeUUID();
        try {
          localStorage.setItem(STORAGE_KEY, sessionId);
        } catch (_) { /* storage blocked */ }
      }

      // Hidden input
      let hiddenInput = document.getElementById("sessionId");
      if (!hiddenInput) {
        hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.id = "sessionId";
        hiddenInput.name = "sessionId";
        document.body.appendChild(hiddenInput);
      }
      hiddenInput.value = sessionId;

      // Styles (avoid duplicate)
      if (!document.getElementById("chatbot-widget-style")) {
        const style = document.createElement("style");
        style.id = "chatbot-widget-style";
        style.textContent = `
          @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazir-font@v30.1.0/dist/font-face.css');

          .chatbot-container, 
          .chatbot-container * {
            font-family: Vazir, sans-serif !important;
          }

          .chatbot-container {
            position: fixed;
            bottom: 100px;
            right: 20px;
            width: 380px;
            height: 580px;
            background: ${colors.background};
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 1000;
            color: ${colors.text};
            direction: rtl;
            text-align: right;
          }

          .chatbot-container.open {
            display: flex;
            animation: fadeInUp 0.3s ease-out;
          }

          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .chat-header {
            position: relative;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: bold;
            background: ${colors.primary};
            color: #fff;
          }

          .chat-header button {
            background: none;
            border: none;
            color: #fff;
            font-size: 20px;
            cursor: pointer;
            transition: transform 0.2s;
            position: relative;
            z-index: 1;
          }
          .chat-header button:hover { transform: scale(1.2); }

          .chat-body {
            padding: 12px;
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: #fafafa;
          }

          .message {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            padding: 10px 14px;
            border-radius: 18px;
            max-width: 85%;
            line-height: 1.5;
            font-size: 14px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            word-break: break-word;
            white-space: pre-wrap;
          }
          .message.bot {
            background: ${colors.secondary};
            align-self: flex-start;
          }
          .message.user {
            background: ${colors.userMessage};
            align-self: flex-end;
            flex-direction: row-reverse;
          }
          .message .icon { font-size: 16px; }

          .chat-input {
            position: relative;
            border-top: 1px solid #eee;
            padding: 8px 12px;
            background: #fff;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .chat-input input {
            width: 100%;
            border: 1px solid #ddd;
            border-radius: 20px;
            padding: 10px 14px;
            padding-left: 60px;     
            padding-right: 14px;
            font-size: 14px;
            outline: none;
            direction: rtl;
            text-align: right;
            box-sizing: border-box;
          }

          .chat-input input::placeholder { color: #999; }

          .chat-input button {
            position: absolute;
            left: 14px;
            top: 17%;
            background: #f1f1f1;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            z-index: 3;
            transition: background 0.2s;
          }

          .chat-toggle-btn {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: ${colors.primary};
            color: white;
            border: none;
            font-size: 26px;
            /* padding: 16px; */
            width: 50px;
            height: 50px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 1001;
            transition: transform 0.2s;
          }

          .chat-toggle-btn svg {
            width: 20px;
            height: 20px;
            fill: white;
          }

          .chat-toggle-btn:hover { transform: scale(1.1); }

          .chat-footer {
            font-size: 11px;
            text-align: center;
            padding: 6px;
            color: #777;
            border-top: 1px solid #eee;
            background: #fdfdfd;
          }

          /* Loading dots */
          .loading-dots {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 6px 12px;
            border-radius: 12px;
            background: ${colors.secondary};
            align-self: flex-start;
          }
          .loading-dots span {
            width: 6px;
            height: 6px;
            background: ${colors.primary};
            border-radius: 50%;
            animation: bounce 1.2s infinite ease-in-out;
          }
          .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
          .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
          @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
          }

          #chatbot-send { transform: rotate(180deg); }

          @media (max-width: 768px) {
            .chatbot-container {
              width: 100vw !important;
              height: 100vh !important;
              bottom: 0 !important;
              right: 0 !important;
              border-radius: 0 !important;
              max-height: none !important;
            }
            .chat-header { border-radius: 0 !important; }
          }
        `;
        document.head.appendChild(style);
      }

      // HTML
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="chatbot-container" id="chatbot-widget">
          <div class="chat-header">
            <span>${title}</span>
            <button id="chatbot-close" aria-label="Close">&times;</button>
          </div>
          <div class="chat-body" id="chatbot-body"></div>
          <div class="chat-input">
            <input type="text" id="chatbot-input" placeholder="پیام ..." />
            <button id="chatbot-send" aria-label="Send">
              <svg xmlns="http://www.w3.org/2000/svg" color="black" width="24" height="24" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                   class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-down-dashed">
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M12 5v.5m0 3v1.5m0 3v6" />
                <path d="M18 13l-6 6" />
                <path d="M6 13l6 6" />
              </svg>
            </button>
          </div>
          <div class="chat-footer">Powered by <strong>AvidFlow</strong></div>
        </div>
        <button class="chat-toggle-btn" id="chatbot-toggle" aria-label="Open chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="icon icon-tabler icons-tabler-outline icon-tabler-message">
            <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
            <path d="M8 9h8" />
            <path d="M8 13h6" />
            <path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z" />
          </svg>
        </button>
      `;
      document.body.appendChild(container);

      // Behavior
      const widget = document.getElementById("chatbot-widget");
      const toggleBtn = document.getElementById("chatbot-toggle");
      const closeBtn = document.getElementById("chatbot-close");
      const sendBtn = document.getElementById("chatbot-send");
      const chatBody = document.getElementById("chatbot-body");
      const input = document.getElementById("chatbot-input");

      function typeMessage(containerEl, text, className = "bot", includeLogo = false) {
        if (includeLogo && logoUrl) {
          const logo = document.createElement("img");
          logo.src = logoUrl;
          logo.style.width = "180px";
          logo.style.height = "100px";
          logo.style.objectFit = "contain";
          logo.style.margin = "10px auto";
          logo.style.display = "block";
          logo.style.borderRadius = "50%";
          containerEl.appendChild(logo);
        }

        if (serviceTitle) {
          const titleEl = document.createElement("div");
          titleEl.textContent = serviceTitle;
          titleEl.style.textAlign = "center";
          titleEl.style.fontWeight = "bold";
          titleEl.style.marginBottom = "8px";
          titleEl.style.fontSize = "14px";
          containerEl.appendChild(titleEl);
        }

        const msg = document.createElement("div");
        msg.className = `message ${className}`;
        msg.innerHTML = `<span class="icon"></span><span class="bot-text"></span>`;
        containerEl.appendChild(msg);

        const textEl = msg.querySelector(".bot-text");
        let i = 0;
        const interval = setInterval(() => {
          textEl.textContent += text[i] || "";
          containerEl.scrollTop = containerEl.scrollHeight;
          i++;
          if (i >= text.length) clearInterval(interval);
        }, 30);
      }

      // Initial message
      typeMessage(chatBody, botInitialMessage, "bot", true);

      const chatSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             class="icon icon-tabler icons-tabler-outline icon-tabler-message">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M8 9h8" />
          <path d="M8 13h6" />
          <path d="M18 4a 3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z" />
        </svg>
      `;

      const closeSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
             viewBox="0 0 24 24" fill="currentColor"
             class="icon icon-tabler icons-tabler-filled icon-tabler-square-rounded-arrow-down">
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M12 2c-.218 0 -.432 .002 -.642 .005l-.616 .017l-.299 .013l-.579 .034l-.553 .046c-4.785 .464 -6.732 2.411 -7.196 7.196l-.046 .553l-.034 .579c-.005 .098 -.01 .198 -.013 .299l-.017 .616l-.004 .318l-.001 .324c0 .218 .002 .432 .005 .642l.017 .616l.013 .299l.034 .579l.046 .553c.464 4.785 2.411 6.732 7.196 7.196l.553 .046l.579 .034c.098 .005 .198 .01 .299 .013l.616 .017l.642 .005l.642 -.005l.616 -.017l.299 -.013l.579 -.034l.553 -.046c4.785 -.464 6.732 -2.411 7.196 -7.196l.046 -.553l.034 -.579c.005 -.098 .01 -.198 .013 -.299l.017 -.616l.005 -.642l-.005 -.642l-.017 -.616l-.013 -.299l-.034 -.579l-.046 -.553c-.464 -4.785 -2.411 -6.732 -7.196 -7.196l-.553 -.046l-.579 -.034a28.058 28.058 0 0 0 -.299 -.013l-.616 -.017l-.318 -.004l-.324 -.001zm0 5a1 1 0 0 1 .993 .883l.007 .117v5.585l2.293 -2.292a1 1 0 0 1 1.32 -.083l.094 .083a1 1 0 0 1 .083 1.32l-.083 .094l-4 4a1.008 1.008 0 0 1 -.112 .097l-.11 .071l-.114 .054l-.105 .035l-.149 .03l-.117 .006l-.075 -.003l-.126 -.017l-.111 -.03l-.111 -.044l-.098 -.052l-.092 -.064l-.094 -.083l-4 -4a1 1 0 0 1 1.32 -1.497l.094 .083l2.293 2.292v-5.585a1 1 0 0 1 1 -1z" fill="currentColor" stroke-width="0" />
        </svg>
      `;

      // Toggle behavior
      const updateToggleIcon = () => {
        toggleBtn.innerHTML = widget.classList.contains("open") ? closeSvg : chatSvg;
      };

      toggleBtn.onclick = () => {
        widget.classList.toggle("open");
        updateToggleIcon();
        if (widget.classList.contains("open")) input.focus();
      };

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && widget.classList.contains("open")) {
          widget.classList.remove("open");
          updateToggleIcon();
        }
      });

      // Ensure initial scroll
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

      closeBtn.onclick = () => {
        widget.classList.remove("open");
        updateToggleIcon();
      };

      async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // User message
        const userMsg = document.createElement("div");
        userMsg.className = "message user";
        userMsg.innerHTML = `<span>${text}</span><span class="icon">👤</span>`;
        chatBody.appendChild(userMsg);
        input.value = "";
        chatBody.scrollTop = chatBody.scrollHeight;

        // Loading indicator
        const loadingMsg = document.createElement("div");
        loadingMsg.className = "loading-dots";
        loadingMsg.innerHTML = `<span></span><span></span><span></span>`;
        chatBody.appendChild(loadingMsg);
        chatBody.scrollTop = chatBody.scrollHeight;

        try {
          const payload = { chatInput: text, sessionId };
          const res = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          let data = {};
          try {
            data = await res.json();
          } catch (_) {
            // non-JSON or empty body
          }

          loadingMsg.remove();

          const botReply = (data && (data.text || data.output)) || " لطفاً دوباره تلاش کنید. ❗";

          const botMsg = document.createElement("div");
          botMsg.className = "message bot";
          botMsg.innerHTML = `<span class="icon"></span><span class="bot-text"></span>`;
          chatBody.appendChild(botMsg);
          const botTextEl = botMsg.querySelector(".bot-text");

          let i = 0;
          const typingInterval = setInterval(() => {
            botTextEl.textContent += botReply[i] || "";
            i++;
            chatBody.scrollTop = chatBody.scrollHeight;
            if (i >= botReply.length) clearInterval(typingInterval);
          }, 50);
        } catch (err) {
          loadingMsg.remove();
          const errorMsg = document.createElement("div");
          errorMsg.className = "message bot";
          errorMsg.innerHTML = `<span class="icon">⚠️</span><span>خطایی رخ داد.</span>`;
          chatBody.appendChild(errorMsg);
        }
      }

      sendBtn.onclick = sendMessage;
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
      });
    },
  };
})();
