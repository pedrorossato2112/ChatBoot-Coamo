import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Config Firebase
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

// Elementos
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const inputMsg = document.getElementById("novaMensagem");
const btnSend = document.getElementById("enviarBtn");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const friendEmailInput = document.getElementById("friendEmail");
const friendApelidoInput = document.getElementById("friendApelido");
const startChatBtn = document.getElementById("startChatBtn");
const contatosListDiv = document.getElementById("contatosList");
const typingIndicator = document.getElementById("typingIndicator");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;
let apelidosCache = {};
let respostaMsg = null;

// Gera id da conversa (ordem alfabética dos emails)
function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

// Carrega apelidos do localStorage
async function carregarApelidosCache() {
  const cacheLocal = localStorage.getItem("apelidosCache");
  apelidosCache = cacheLocal ? JSON.parse(cacheLocal) : {};
}

// Salva apelido no Firestore e cache local
async function salvarApelido(apelido) {
  if (!auth.currentUser) return;
  apelidosCache[auth.currentUser.email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  try {
    const userDocRef = doc(db, "users", auth.currentUser.email);
    await setDoc(userDocRef, { nickname: apelido }, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar apelido:", error);
  }
}

// Retorna apelido do usuário
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
    console.error("Erro ao buscar apelido:", error);
  }
  return email;
}

// Salva contato localmente
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

// Carrega contatos e exibe na lista
function carregarContatos() {
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  contatosListDiv.innerHTML = "";
  contatos.forEach(c => {
    const contatoBtn = document.createElement("button");
    contatoBtn.textContent = c.apelido;
    contatoBtn.style.width = "100%";
    contatoBtn.style.marginBottom = "5px";
    contatoBtn.onclick = () => abrirConversa(gerarIdConversa(auth.currentUser.email, c.email));
    contatosListDiv.appendChild(contatoBtn);
  });
}

// Atualiza o indicador de digitando
async function atualizarDigitando(status) {
  if (!conversaIdAtual || !auth.currentUser) return;
  const conversaRef = doc(db, "conversas", conversaIdAtual);
  await setDoc(conversaRef, { [`digitando_${auth.currentUser.email}`]: status }, { merge: true });
}

// Abre a conversa
async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) unsubscribeMensagens();
  if (unsubscribeTyping) unsubscribeTyping();

  conversaIdAtual = conversaId;
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async snapshot => {
    const chatBox = document.getElementById("mensagens");
    chatBox.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      // Menu 3 pontinhos
      const menu = document.createElement("div");
      menu.classList.add("menu-msg");
      menu.textContent = "⋮";
      const opcoes = document.createElement("div");
      opcoes.classList.add("menu-opcoes");
      ["Apagar", "Editar", "Copiar"].forEach(op => {
        const btn = document.createElement("button");
        btn.textContent = op;
        btn.onclick = () => alert(`${op} clicado!`);
        opcoes.appendChild(btn);
      });
      menu.onclick = () => { opcoes.style.display = opcoes.style.display === "block" ? "none" : "block"; };
      msgEl.appendChild(menu);
      msgEl.appendChild(opcoes);

      const apelidoRemetente = await getApelido(data.usuario);
      msgEl.textContent += `${apelidoRemetente}: ${data.texto}`;
      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  // Listener digitando
  const conversaDoc = doc(db, "conversas", conversaId);
  unsubscribeTyping = onSnapshot(conversaDoc, async docSnap => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    const amigoEmail = conversaId.split("_").find(email => email !== auth.currentUser.email);
    const apelido = await getApelido(amigoEmail);
    typingIndicator.textContent = data[`digitando_${amigoEmail}`] ? `${apelido} está digitando...` : "";
  });
}

// Enviar mensagem
btnSend.addEventListener("click", async () => {
  const msg = inputMsg.value.trim();
  if (!msg || !conversaIdAtual) return;
  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  const dadosMsg = {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
    lidoPor: [auth.currentUser.email],
  };
  await addDoc(mensagensRef, dadosMsg);
  inputMsg.value = "";
  await atualizarDigitando(false);
});

// Botão iniciar conversa com contato
startChatBtn.addEventListener("click", async () => {
  const email = friendEmailInput.value.trim().toLowerCase();
  const apelido = friendApelidoInput.value.trim();
  if (!email || !apelido || email === auth.currentUser.email) return alert("Email/apelido inválidos.");
  salvarContato(email, apelido);
  abrirConversa(gerarIdConversa(auth.currentUser.email, email));
  friendEmailInput.value = "";
  friendApelidoInput.value = "";
});

// Autenticação
onAuthStateChanged(auth, async user => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    await carregarApelidosCache();
    const apelido = apelidosCache[user.email] || user.email;
    userApelidoDisplay.textContent = apelido;
    carregarContatos();
  } else {
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});
