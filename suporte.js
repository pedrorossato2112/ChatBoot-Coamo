import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const userApelidoSpan = document.getElementById("userApelido");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const friendEmailInput = document.getElementById("friendEmail");
const friendApelidoInput = document.getElementById("friendApelido");
const startChatBtn = document.getElementById("startChatBtn");
const chatBox = document.getElementById("chat-box");
const typingIndicator = document.getElementById("typingIndicator");
const logoutBtn = document.getElementById("logoutBtn");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
const respostaBox = document.getElementById("respostaBox");

let conversaIdAtual = null;
let respostaMsg = null;
let apelidosCache = {};

// Modal Apelido
const nicknameModal = document.createElement("div");
nicknameModal.id = "nicknameModal";
nicknameModal.style = `
  position: fixed; top:0; left:0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
`;
nicknameModal.innerHTML = `
  <div style="background:#fff; padding:20px; border-radius:8px; max-width:320px; width:90%; box-shadow:0 2px 10px rgba(0,0,0,0.3); text-align:center;">
    <h3>Escolha um apelido</h3>
    <input type="text" id="nicknameInput" placeholder="Digite seu apelido" style="width:100%; padding:8px; margin-bottom:12px; font-size:16px;"/>
    <button id="saveNicknameBtn" style="padding:10px 20px; font-size:16px;">Salvar</button>
  </div>
`;
document.body.appendChild(nicknameModal);
nicknameModal.style.display = "none";

const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");

// Funções utilitárias
function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function salvarApelido(apelido) {
  if (!auth.currentUser) return;
  apelidosCache[auth.currentUser.email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  try {
    const userDocRef = doc(db, "users", auth.currentUser.email);
    await setDoc(userDocRef, { nickname: apelido }, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar apelido no Firestore:", error);
  }
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
    if (userDocSnap.exists()) {
      const data = userDocSnap.data();
      if (data.nickname) {
        apelidosCache[email] = data.nickname;
        localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
        return data.nickname;
      }
    }
  } catch (error) {
    console.error("Erro ao buscar apelido:", error);
  }
  return email;
}

function mostrarNicknameModal() { nicknameModal.style.display = "flex"; nicknameInput.value = apelidosCache[auth.currentUser.email] || ""; nicknameInput.focus(); }
function esconderNicknameModal() { nicknameModal.style.display = "none"; }

// Contatos
function carregarContatos() {
  let contatos = JSON.parse(localStorage.getItem("contatosChat") || "[]");
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(({ email, apelido }) => {
      const option = document.createElement("option");
      option.value = email;
      option.textContent = apelido;
      contatosSalvosSelect.appendChild(option);
    });
  } else {
    contatosSalvosSelect.style.display = "none";
  }
}

function salvarContato(email, apelido) {
  if (!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat") || "[]");
  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
}

// UI resposta
function atualizarRespostaUI() {
  if (!respostaMsg) {
    respostaBox.style.display = "none";
    respostaBox.innerHTML = "";
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

// Abrir conversa
async function abrirConversa(conversaId) {
  chatBox.innerHTML = "";
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  onSnapshot(q, async snapshot => {
    chatBox.innerHTML = "";
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      if (!data.lidoPor?.includes(auth.currentUser.email)) {
        await updateDoc(docSnap.ref, { lidoPor: [...(data.lidoPor || []), auth.currentUser.email] });
      }

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg", data.usuario === auth.currentUser.email ? "own" : "friend");

      let remetente = await getApelido(data.usuario);

      let textoMsg = "";
      if (data.respondeA) {
        const apelidoResp = await getApelido(data.respondeA.usuario);
        textoMsg += `${apelidoResp}: ${data.respondeA.texto}\n→ `;
      }
      textoMsg += data.texto;
      msgEl.textContent = `${remetente}: ${textoMsg}`;

      msgEl.addEventListener("click", () => {
        respostaMsg = { id, texto: data.texto, usuario: data.usuario };
        atualizarRespostaUI();
        inputMsg.focus();
      });

      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// Eventos
saveNicknameBtn.addEventListener("click", async () => {
  const apelido = nicknameInput.value.trim();
  if (apelido.length < 2) return alert("Digite um apelido com pelo menos 2 caracteres.");
  await salvarApelido(apelido);
  userEmailSpan.textContent = apelido;
  esconderNicknameModal();
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  try { await signInWithEmailAndPassword(auth, email, password); } 
  catch(e){ alert("Erro no login: "+e.message); }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const apelido = document.getElementById("apelido").value.trim();
  if (!apelido) return alert("Digite seu apelido antes de cadastrar.");
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    await salvarApelido(apelido);
    alert("Cadastro realizado com sucesso!");
  } catch(e){ alert("Erro no cadastro: "+e.message); }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

btnSend.addEventListener("click", async () => {
  const msg = inputMsg.value.trim();
  if (!msg || !conversaIdAtual) return;
  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  const dadosMsg = { texto: msg, usuario: auth.currentUser.email, timestamp: serverTimestamp(), lidoPor: [auth.currentUser.email] };
  if (respostaMsg) dadosMsg.respondeA = { id: respostaMsg.id, texto: respostaMsg.texto, usuario: respostaMsg.usuario };
  await addDoc(mensagensRef, dadosMsg);
  inputMsg.value = ""; respostaMsg = null; atualizarRespostaUI();
});

startChatBtn.addEventListener("click", () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const apelidoAmigo = friendApelidoInput.value.trim() || amigo;
  const usuario = auth.currentUser.email.toLowerCase();
  if (!amigo || amigo === usuario) return alert("Email inválido/diferente do seu");
  salvarContato(amigo, apelidoAmigo);
  conversaIdAtual = gerarIdConversa(usuario, amigo);
  abrirConversa(conversaIdAtual);
});

// Autenticação
onAuthStateChanged(auth, user => {
  if (user) {
    loginDiv.style.display = "none"; chatDiv.style.display = "flex";
    userEmailSpan.textContent = apelidosCache[user.email] || user.email;
    carregarApelidosCache(); carregarContatos();
  } else { loginDiv.style.display = "flex"; chatDiv.style.display = "none"; }
});
