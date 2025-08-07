// Referência ao banco de dados
const db = firebase.database();
const messagesRef = db.ref("mensagens");

// Elementos
const input = document.getElementById("input-msg");
const sendBtn = document.getElementById("btn-send");
const chatBox = document.getElementById("chat-box");

// Envia mensagem
sendBtn.addEventListener("click", () => {
  const texto = input.value.trim();
  if (texto !== "") {
    const novaMensagem = {
      texto: texto,
      timestamp: Date.now()
    };
    messagesRef.push(novaMensagem);
    input.value = "";
  }
});

// Exibe mensagens em tempo real
messagesRef.on("child_added", (snapshot) => {
  const msg = snapshot.val();
  const div = document.createElement("div");
  div.textContent = msg.texto;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});
