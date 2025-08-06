// Configuração Firebase - coloque aqui as suas chaves do Firebase
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  databaseURL: "https://SEU_DOMINIO.firebaseio.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const messagesRef = db.ref("chat");

// Referências DOM
const chatBox = document.getElementById('chat-box');
const inputMsg = document.getElementById('input-msg');
const btnSend = document.getElementById('btn-send');

// Função para adicionar mensagem na tela
function appendMessage(text, sender) {
  const div = document.createElement('div');
  div.classList.add('message', sender);
  div.textContent = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Enviar mensagem para o Firebase
function sendMessage(userType, text) {
  messagesRef.push({
    user: userType,
    text: text,
    timestamp: Date.now()
  });
}

// Ouvir novas mensagens no Firebase
messagesRef.on('child_added', snapshot => {
  const msg = snapshot.val();
  appendMessage(`${msg.user}: ${msg.text}`, msg.user);
});

// Defina o tipo de usuário aqui: 'suporte' ou 'cliente'
// Você pode trocar para 'cliente' se quiser testar do lado do cliente.
const userType = 'suporte';

btnSend.addEventListener('click', () => {
  const text = inputMsg.value.trim();
  if (!text) return;
  sendMessage(userType, text);
  inputMsg.value = "";
});

inputMsg.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnSend.click();
});
