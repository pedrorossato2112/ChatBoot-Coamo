import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, getDoc 
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

btnSend.addEventListener("click", async ()=> {
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

// ------------------- LOGIN -------------------
loginBtn.addEventListener("click", async ()=> {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch(err) {
    alert("Erro no login: "+err.message);
  }
});

// ------------------- REGISTRO -------------------
registerBtn.addEventListener("click", async ()=> {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();
  const apelido = nicknameInput.value.trim() || email;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    await setDoc(doc(db, "users", email), {
      tipo: "chamado",
      nickname: apelido
    });
    alert("Cadastro realizado! Faça login.");
  } catch(err) {
    alert("Erro no registro: "+err.message);
  }
});

// ------------------- AUTENTICAÇÃO -------------------
onAuthStateChanged(auth, async (user)=> {
  if(user){
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    const userDoc = await getDoc(doc(db, "users", user.email));
    if(!userDoc.exists()) return alert("Usuário não encontrado!");

    const tipo = userDoc.data().tipo;
    userApelidoDisplay.textContent = userDoc.data().nickname || user.email;

    if(tipo === "suporte"){
      sidebar.style.display = "flex"; 
      const q = query(collection(db, "users"));
      onSnapshot(q, snapshot => {
        contatosBox.innerHTML = "";
        snapshot.docs.forEach(d => {
          if(d.data().tipo === "chamado"){
            const div = document.createElement("div");
            div.textContent = d.data().nickname;
            div.classList.add("contatoItem");
            div.addEventListener("click", ()=> abrirConversa(gerarIdConversa(user.email, d.id)));
            contatosBox.appendChild(div);
          }
        });
      });
    } else {
      sidebar.style.display = "none"; 
      const suporteQ = await getDoc(doc(db, "users", "seuemail@dominio.com"));
      if(suporteQ.exists()) abrirConversa(gerarIdConversa(user.email, "seuemail@dominio.com"));
    }
  } else {
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});

saveNicknameBtn.addEventListener("click", async ()=> {
  const nick = nicknameInput.value.trim();
  if(!nick) return alert("Digite um apelido!");
  userApelidoDisplay.textContent = nick;
  nicknameModal.style.display = "none";
});

logoutBtn.addEventListener("click", async ()=> {
  await signOut(auth);
});
