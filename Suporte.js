const firebaseConfig = {
  apiKey: "SUA_CHAVE",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  databaseURL: "https://SEU_DOMINIO.firebaseio.com",
  projectId: "SEU_ID",
  storageBucket: "SEU_BUCKET",
  messagingSenderId: "SEU_ID",
  appId: "SEU_ID"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const messagesRef = db.ref("chat");

// Enviar mensagem
function sendMessage(user, text) {
  messagesRef.push({ user, text });
}

// Ouvir novas mensagens
messagesRef.on("child_added", function(snapshot) {
  const message = snapshot.val();
  mostrarMensagemNaTela(message.user, message.text);
});


function mostrarMensagemNaTela(user, text) {
  const chat = document.getElementById("chat");
  const msg = document.createElement("div");
  msg.innerText = `${user}: ${text}`;
  chat.appendChild(msg);
}
