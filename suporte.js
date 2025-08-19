import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const ATENDENTE_EMAIL = "seuemail@dominio.com"; // <-- coloque aqui o email do atendente

// ---------------- ELEMENTOS ----------------
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const contatosBox = document.getElementById("contatosBox");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const chatBox = document.getElementById("chat-box");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");
const sidebar = document.querySelector(".sidebar");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let apelidosCache = {};

function gerarIdConversa(usuario1, usuario2){
  return [usuario1, usuario2].sort().join("_");
}

async function abrirConversa(conversaId){
  conversaIdAtual = conversaId;
  if(unsubscribeMensagens) unsubscribeMensagens();

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));
  
  unsubscribeMensagens = onSnapshot(q, async snapshot => {
    chatBox.innerHTML = "";
    for(const docSnap of snapshot.docs){
      const data = docSnap.data();
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");
      msgEl.textContent = data.texto;
      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

btnSend.addEventListener("click", async ()=>{
  const texto = inputMsg.value.trim();
  if(!texto || !conversaIdAtual) return;
  const ref = collection(db, "conversas", conversaIdAtual, "mensagens");
  await addDoc(ref, {
    texto,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp()
  });
  inputMsg.value = "";
});

loginBtn.addEventListener("click", async ()=>{
  try{
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  }catch(err){
    alert("Erro no login: "+err.message);
  }
});

registerBtn.addEventListener("click", async ()=>{
  try{
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    alert("Usuário registrado com sucesso!");
  }catch(err){
    alert("Erro no registro: "+err.message);
  }
});

onAuthStateChanged(auth, async (user)=>{
  if(user){
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    if(user.email === ATENDENTE_EMAIL){
      sidebar.style.display = "flex"; // atendente vê os clientes
    } else {
      sidebar.style.display = "none"; // cliente só vê você
      abrirConversa(gerarIdConversa(user.email, ATENDENTE_EMAIL));
    }
  }else{
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});

saveNicknameBtn.addEventListener("click", async ()=>{
  const nick = nicknameInput.value.trim();
  if(!nick) return alert("Digite um apelido!");
  userApelidoDisplay.textContent = nick;
  nicknameModal.style.display = "none";
});

logoutBtn.addEventListener("click", async ()=>{
  await signOut(auth);
});
