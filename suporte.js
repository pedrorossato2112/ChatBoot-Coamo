import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const btnSend = document.getElementById("btn-send");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
const nicknameModal = document.createElement("div");
nicknameModal.id = "nicknameModal";
nicknameModal.style = `
  position: fixed;
  top:0;
  left:0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
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
let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;
let apelidosCache = {};
let respostaMsg = null;

function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function atualizarDigitando(status) {
  if (!conversaIdAtual || !auth.currentUser) return;
  const conversaRef = doc(db, "conversas", conversaIdAtual);
  try {
    await setDoc(conversaRef, { [`digitando_${auth.currentUser.email}`]: status }, { merge: true });
  } catch (error) {
    console.error("Erro ao atualizar digitando:", error);
  }
}

function carregarContatos() {
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
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
  if (!email) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
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

async function buscarApelidoFirestore(email) {
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
    console.error("Erro ao buscar apelido no Firestore:", error);
  }
  return email;
}

async function getApelido(email) {
  if (!email) return "Anônimo";
  if (apelidosCache[email]) return apelidosCache[email];
  return await buscarApelidoFirestore(email);
}

function mostrarNicknameModal() {
  nicknameModal.style.display = "flex";
  nicknameInput.value = apelidosCache[auth.currentUser.email] || "";
  nicknameInput.focus();
}

function esconderNicknameModal() {
  nicknameModal.style.display = "none";
}

saveNicknameBtn.addEventListener("click", async () => {
  const apelido = nicknameInput.value.trim();
  if (apelido.length < 2) {
    alert("Digite um apelido com pelo menos 2 caracteres.");
    return;
  }
  await salvarApelido(apelido);
  userEmailSpan.textContent = apelido;
  esconderNicknameModal();
});

function atualizarRespostaUI() {
  const respostaBox = document.getElementById("respostaBox");
  if (!respostaMsg) {
    respostaBox.style.display = "none";
    respostaBox.textContent = "";
    return;
  }
  getApelido(respostaMsg.usuario).then((apelido) => {
    respostaBox.style.display = "block";
    respostaBox.innerHTML = `<strong>${apelido}:</strong> ${respostaMsg.texto} <button id="cancelReplyBtn" title="Cancelar resposta">×</button>`;
    const btnCancel = document.getElementById("cancelReplyBtn");
    btnCancel.onclick = () => {
      respostaMsg = null;
      atualizarRespostaUI();
    };
  });
}
