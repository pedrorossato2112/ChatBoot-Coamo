// Configuração do Firebase
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

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);

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
