// Configuração do Firebase (mesmo que já tenha no HTML, mas pode ficar só no HTML se preferir)
var firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  databaseURL: "https://chatboot--coamo-default-rtdb.firebaseio.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const messagesRef = db.ref("mensagens");

// Pergunta se é suporte ou cliente
const sender = prompt("Quem está usando este chat? Digite 'suporte' ou 'cliente':")?.toLowerCase() || "cliente";

const input = document.getElementById("input-msg");
const sendBtn = document.getElementById("btn-send");
const chatBox = document.getElementById("chat-box");

function addMessage(text, userType) {
  const div = document.createElement("div");
  div.textContent = text;
  div.classList.add("message");
  if(userType === "suporte") {
    div.classList.add("suporte");
  } else {
    div.classList.add("cliente");
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.addEventListener("click", () => {
  const text = input.value.trim();
  if(!text) return;

  // Envia mensagem para o Firebase com quem enviou
  messagesRef.push({
    sender: sender,
    text: text,
    timestamp: Date.now()
  });

  input.value = "";
});

// Ouve mensagens em tempo real
messagesRef.on("child_added", snapshot => {
  const msg = snapshot.val();

  // Não mostrar a mensagem duplicada que acabou de enviar (opcional)
  // Se quiser mostrar mesmo a sua, pode remover essa condição
  // if(msg.sender === sender && msg.text === input.value) return;

  addMessage(msg.text, msg.sender);
});
