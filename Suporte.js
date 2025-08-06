const chatBox = document.getElementById('chat-box');
const inputMsg = document.getElementById('input-msg');
const btnSend = document.getElementById('btn-send');

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  msgDiv.classList.add(sender);
  msgDiv.textContent = text;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Simula uma resposta do suporte após 1.5s
function suporteResponder() {
  setTimeout(() => {
    appendMessage("Olá! Como posso ajudar você?", "suporte");
  }, 1500);
}

btnSend.addEventListener('click', () => {
  const text = inputMsg.value.trim();
  if (text === "") return;
  appendMessage(text, "cliente");
  inputMsg.value = "";
  // Resposta automática do suporte
  suporteResponder();
});

// Enviar mensagem ao apertar Enter
inputMsg.addEventListener('keydown', (e) => {
  if (e.key === "Enter") {
    btnSend.click();
  }
});

// Mensagem inicial do suporte
suporteResponder();

// Configuração do Firebase - substitua pelos seus dados do console Firebase
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

// Elementos do DOM
const chatBox = document.getElementById('chat-box');
const inputMsg = document.getElementById('input-msg');
const btnSend = document.getElementById('btn-send');

// Função para adicionar mensagem no chat na tela
function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  msgDiv.classList.add(sender);
  msgDiv.textContent = text;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Enviar mensagem para o Firebase
function sendMessage(user, text) {
  messagesRef.push({ user, text, timestamp: Date.now() });
}

// Ouvir mensagens novas no Firebase e mostrar na tela
messagesRef.on('child_added', snapshot => {
  const msg = snapshot.val();
  appendMessage(`${msg.user}: ${msg.text}`, msg.user === 'cliente' ? 'cliente' : 'suporte');
});

// Evento do botão enviar
btnSend.addEventListener('click', () => {
  const text = inputMsg.value.trim();
  if (!text) return;
  sendMessage('cliente', text);
  inputMsg.value = "";
});

// Enviar mensagem ao apertar Enter
inputMsg.addEventListener('keydown', e => {
  if (e.key === "Enter") btnSend.click();
});
