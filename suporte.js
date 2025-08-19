import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ---------------- CONFIG FIREBASE ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---------------- ELEMENTOS ----------------
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const contatosBox = document.getElementById("contatosBox");
const chatBox = document.getElementById("chat-box");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");

let conversaIdAtual = null;
let unsubscribeMensagens = null;

// ---------------- FUNÇÕES ----------------
function gerarIdConversa(usuario1, usuario2){
  return [usuario1, usuario2].sort().join("_");
}

async function abrirConversa(conversaId){
  conversaIdAtual = conversaId;
  if(unsubscribeMensagens) unsubscribeMensagens();

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, snapshot => {
    chatBox.innerHTML = "";
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");
      msgEl.textContent = data.texto;
      chatBox.appendChild(msgEl);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

function atualizarClientes(){
  const clientesRef = collection(db, "users");
  onSnapshot(clientesRef, snapshot => {
    contatosBox.innerHTML = "";
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      if(data.tipo === "cliente"){ // só clientes
        const div = document.createElement("div");
        div.classList.add("contatoItem");
        div.textContent = data.nickname || data.email;
        div.addEventListener("click", () => abrirConversa(gerarIdConversa(auth.currentUser.email, docSnap.id)));
        contatosBox.appendChild(div);
      }
    });
  });
}

// ---------------- ENVIO ----------------
btnSend.addEventListener("click", async () => {
  if(!inputMsg.value.trim() || !conversaIdAtual) return;
  const ref = collection(db, "conversas", conversaIdAtual, "mensagens");
  await addDoc(ref, {
    texto: inputMsg.value.trim(),
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp()
  });
  inputMsg.value = "";
});

// ---------------- LOGIN ----------------
loginBtn.addEventListener("click", async () => {
  try{
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  }catch(err){
    alert("Erro no login: " + err.message);
  }
});

// ---------------- LOGOUT ----------------
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// ---------------- AUTENTICAÇÃO ----------------
onAuthStateChanged(auth, user => {
  if(user){
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    atualizarClientes();
  }else{
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});
