const db = firebase.database();
const messagesRef = db.ref("mensagens");

const sender = prompt("Quem está usando este chat? Digite 'suporte' ou 'cliente':")?.toLowerCase() || "cliente";

const input = document.getElementById("input-msg");
const sendBtn = document.getElementById("btn-send");
const chatBox = document.getElementById("chat-box");

function addMessage(text, userType) {
  const div = document.createElement("div");
  div.textContent = text;
  div.classList.add("message");
  if (userType === "suporte") {
    div.classList.add("suporte");
  } else {
    div.classList.add("cliente");
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", () => {
  const text = input.value.trim();
  if (!text) return;

  messagesRef.push({
    sender: sender,
    text: text,
    timestamp: Date.now()
  });

  input.value = "";
});

messagesRef.on("child_added", snapshot => {
  const msg = snapshot.val();
  addMessage(msg.text, msg.sender);
});
