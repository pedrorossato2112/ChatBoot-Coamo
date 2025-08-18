import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, setDoc, updateDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos DOM
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const userEmailSpan = document.getElementById("userEmail");
const btnSend = document.getElementById("btn-send");
const inputMsg = document.getElementById("input-msg");
const friendEmailInput = document.getElementById("friendEmail");
const startChatBtn = document.getElementById("startChatBtn");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
const typingIndicator = document.getElementById("typingIndicator");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let respostaMsg = null;
let apelidosCache = {};

// Funções utilitárias
function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function atualizarDigitando(status) {
  if (!conversaIdAtual || !auth.currentUser) return;
  const conversaRef = doc(db, "conversas", conversaIdAtual);
  await setDoc(conversaRef, { [`digitando_${auth.currentUser.email}`]: status }, { merge: true });
}

function salvarContato(email, apelido) {
  if (!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
}

function carregarContatos() {
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(c => {
      const option = document.createElement("option");
      option.value = c.email;
      option.textContent = c.apelido;
      contatosSalvosSelect.appendChild(option);
    });
  } else {
    contatosSalvosSelect.style.display = "none";
  }
}

async function salvarApelido(apelido) {
  if (!auth.currentUser) return;
  apelidosCache[auth.currentUser.email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  const userDocRef = doc(db, "users", auth.currentUser.email);
  await setDoc(userDocRef, { nickname: apelido }, { merge: true });
}

async function carregarApelidosCache() {
  const cacheLocal = localStorage.getItem("apelidosCache");
  apelidosCache = cacheLocal ? JSON.parse(cacheLocal) : {};
}

async function getApelido(email) {
  if (!email) return "Anônimo";
  if (apelidosCache[email]) return apelidosCache[email];
  try {
    const userDocRef = doc(db, "users", email);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists() && userDocSnap.data().nickname) {
      apelidosCache[email] = userDocSnap.data().nickname;
      localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
      return apelidosCache[email];
    }
  } catch (error) {
    console.error("Erro ao buscar apelido no Firestore:", error);
  }
  return email;
}

function atualizarRespostaUI() {
  const respostaBox = document.getElementById("respostaBox");
  if (!respostaMsg) {
    respostaBox.style.display = "none";
    respostaBox.textContent = "";
    return;
  }
  getApelido(respostaMsg.usuario).then(apelido => {
    respostaBox.style.display = "block";
    respostaBox.innerHTML = `<strong>${apelido}:</strong> ${respostaMsg.texto} <button id="cancelReplyBtn">×</button>`;
    document.getElementById("cancelReplyBtn").onclick = () => {
      respostaMsg = null;
      atualizarRespostaUI();
    };
  });
}

// Eventos
btnSend.addEventListener("click", async () => {
  const msg = inputMsg.value.trim();
  if (!msg || !conversaIdAtual) return;
  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  const dadosMsg = {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
    lidoPor: [auth.currentUser.email]
  };
  if (respostaMsg) {
    dadosMsg.respondeA = { id: respostaMsg.id, texto: respostaMsg.texto, usuario: respostaMsg.usuario };
  }
  await addDoc(mensagensRef, dadosMsg);
  inputMsg.value = "";
  respostaMsg = null;
  atualizarRespostaUI();
  await atualizarDigitando(false);
});

startChatBtn.addEventListener("click", () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const usuario = auth.currentUser.email.toLowerCase();
  if (!amigo || amigo === usuario) return alert("Digite um email válido e diferente do seu.");
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  let contatoEncontrado = contatos.find(c => c.email === amigo);
  if (!contatoEncontrado) {
    const apelidoNovo = prompt("Digite um apelido para esse contato:");
    if (!apelidoNovo) return alert("Você precisa informar um apelido para iniciar a conversa.");
    salvarContato(amigo, apelidoNovo);
  }
  conversaIdAtual = gerarIdConversa(usuario, amigo);
  abrirConversa(conversaIdAtual);
});

// Autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    await carregarApelidosCache();
    const apelido = apelidosCache[user.email] || user.email;
    userEmailSpan.textContent = apelido;
    carregarContatos();
    btnSend.disabled = true;
    inputMsg.disabled = true;
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
  }
});

// Função principal para abrir conversa
async function abrirConversa(conversaId) {
  const chatBox = document.getElementById("chat-box");
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  if (unsubscribeMensagens) unsubscribeMensagens();
  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    chatBox.innerHTML = "";
    const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
    const apelidoUsuario = localStorage.getItem("userApelido") || auth.currentUser.email;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;
      if (!data.lidoPor?.includes(auth.currentUser.email)) {
        updateDoc(docSnap.ref, { lidoPor: [...(data.lidoPor || []), auth.currentUser.email] }).catch(console.error);
      }
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg", data.usuario === auth.currentUser.email ? "own" : "friend");

      let remetenteApelido = data.usuario;
      const contatoMsg = contatos.find(c => c.email === data.usuario);
      if (contatoMsg) remetenteApelido = contatoMsg.apelido;
      else if (data.usuario === auth.currentUser.email) remetenteApelido = apelidoUsuario;

      let textoMsg = "";
      if (data.respondeA) {
        const apelidoResposta = await getApelido(data.respondeA.usuario);
        textoMsg += `${apelidoResposta}: ${data.respondeA.texto}\n→ `;
      }
      textoMsg += data.texto;
      msgEl.textContent = `${remetenteApelido}: ${textoMsg}`;

      msgEl.addEventListener("click", () => {
        respostaMsg = { id, texto: data.texto, usuario: data.usuario };
        atualizarRespostaUI();
        inputMsg.focus();
      });

      if (data.usuario === auth.currentUser.email) {
        const outros = data.lidoPor.filter(email => email !== auth.currentUser.email);
        const statusEl = document.createElement("div");
        statusEl.classList.add("status");
        statusEl.textContent = outros.length > 0 ? "✓✓ Visto" : "✓ Enviado";
        msgEl.appendChild(statusEl);
      }

      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // Indicador de digitando
  const conversaDoc = doc(db, "conversas", conversaId);
  if (unsubscribeTyping) unsubscribeTyping();
  unsubscribeTyping = onSnapshot(conversaDoc, async (docSnap) => {
    if (!docSnap.exists()) return setDoc(conversaDoc, { [`digitando_${auth.currentUser.email}`]: false }, { merge: true });
    const data = docSnap.data();
    const usuarioAtual = auth.currentUser.email;
    const amigoEmail = conversaId.split("_").find(e => e !== usuarioAtual);
    const apelidoAmigo = (JSON.parse(localStorage.getItem("contatosChat")) || []).find(c => c.email === amigoEmail)?.apelido || amigoEmail;
    typingIndicator.textContent = data[`digitando_${amigoEmail}`] ? `${apelidoAmigo} está digitando...` : "";
  });
}
