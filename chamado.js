import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = { /*...seu config...*/ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const SUPORTE_EMAIL = "rossato.pedrinho@gmail.com";

const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const chatBox = document.getElementById("chat-box");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const logoutBtn = document.getElementById("logoutBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;

function gerarIdConversa(u1, u2){ return [u1,u2].sort().join("_"); }

async function abrirConversa(conversaId){
  conversaIdAtual = conversaId;
  if(unsubscribeMensagens) unsubscribeMensagens();

  const ref = collection(db, "conversas", conversaId, "mensagens");
  const q = query(ref, orderBy("timestamp"));
  
  unsubscribeMensagens = onSnapshot(q, snapshot => {
    chatBox.innerHTML = "";
    snapshot.docs.forEach(docSnap => {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.textContent = data.texto;
      div.classList.add("msg", data.usuario === auth.currentUser.email ? "own" : "friend");
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

btnSend.addEventListener("click", async ()=>{
  if(!inputMsg.value.trim() || !conversaIdAtual) return;
  await addDoc(collection(db, "conversas", conversaIdAtual, "mensagens"), {
    texto: inputMsg.value.trim(),
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp()
  });
  inputMsg.value = "";
});

loginBtn.addEventListener("click", async ()=>{
  try{ await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value); }
  catch(err){ alert("Erro: "+err.message); }
});

registerBtn.addEventListener("click", async ()=>{
  try{
    const cred = await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    await setDoc(doc(db, "users", cred.user.email), {
      tipo: "chamado",
      email: cred.user.email,
      nickname: cred.user.email
    });
    abrirConversa(gerarIdConversa(cred.user.email, SUPORTE_EMAIL));
    alert("Cadastro realizado!");
  }catch(err){ alert("Erro: "+err.message); }
});

logoutBtn.addEventListener("click", ()=>signOut(auth));

onAuthStateChanged(auth, user=>{
  if(user){ loginDiv.style.display="none"; chatDiv.style.display="flex"; abrirConversa(gerarIdConversa(user.email, SUPORTE_EMAIL)); }
  else{ loginDiv.style.display="flex"; chatDiv.style.display="none"; }
});
