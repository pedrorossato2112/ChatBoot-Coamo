// Referências do DOM
const chatBox = document.getElementById("chat-box");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");

// Referência ao banco de dados Firebase (realtime database)
const messagesRef = firebase.database().ref("chat-messages");

// Função para adicionar mensagem na tela
function addMessage(text, sender) {
  const div = document.createElement("div");
  div.textContent = text;
  div.classList.add("message", sender); // "cliente" ou "suporte"
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight; // rolar para o fim
}

// Enviar mensagem para o Firebase
function sendMessage() {
  const text = inputMsg.value.trim();
  if (!text) return;

  // Aqui você pode definir o tipo de usuário, ex: "suporte"
  const sender = "cliente";

  // Salvar no Firebase
  messagesRef.push({
    sender: sender,
    text: text,
    timestamp: Date.now()
  });

  inputMsg.value = "";
}

// Receber mensagens em tempo real
messagesRef.on("child_added", snapshot => {
  const msg = snapshot.val();
  addMessage(msg.text, msg.sender);
});

// Eventos
btnSend.addEventListener("click", sendMessage);

inputMsg.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    sendMessage();
  }
});
