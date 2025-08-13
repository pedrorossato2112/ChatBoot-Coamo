import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Config Firebase
const firebaseConfig = { /* sua config */ };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Elementos
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const userEmailSpan = document.getElementById("userEmail");
const chatBox = document.getElementById("chat-box");
const typingIndicator = document.getElementById("typingIndicator");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");

const chamadosListContainer = document.getElementById("chamadosListContainer");
const chamadosList = document.getElementById("chamadosList");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let respostaMsg = null;

// ---------- LOGIN E CADASTRO ----------
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try { await signInWithEmailAndPassword(auth, email, password); }
  catch(e){ alert("Erro no login: "+e.message); }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth,email,password);
    alert("Cadastro realizado!");
    // definir tipo default como cooperado
    const userRef = doc(db,"users",email);
    await setDoc(userRef,{tipo:"cooperado"},{merge:true});
  } catch(e){ alert("Erro no cadastro: "+e.message); }
});

document.getElementById("logoutBtn").addEventListener("click", async ()=>{
  await signOut(auth);
  if(unsubscribeMensagens) unsubscribeMensagens();
  if(unsubscribeTyping) unsubscribeTyping();
  conversaIdAtual=null;
  chatBox.innerHTML="";
  chamadosList.innerHTML="";
});

// ---------- FUNÇÕES ----------
async function abrirChamado(cooperadoEmail){
  conversaIdAtual = cooperadoEmail;
  if(unsubscribeMensagens) unsubscribeMensagens();
  if(unsubscribeTyping) unsubscribeTyping();
  chatBox.innerHTML="";
  
  const mensagensRef = collection(db,"chamados",conversaIdAtual,"mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q,(snapshot)=>{
    chatBox.innerHTML="";
    snapshot.docs.forEach(docSnap=>{
      const data = docSnap.data();
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.textContent = data.usuario + ": " + data.texto;
      chatBox.appendChild(msgEl);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// Listar chamados para atendentes
function listarChamados(){
  chamadosList.innerHTML="";
  const chamadosRef = collection(db,"chamados");
  onSnapshot(chamadosRef,(snapshot)=>{
    chamadosList.innerHTML="";
    snapshot.docs.forEach(docSnap=>{
      const li = document.createElement("li");
      li.textContent = docSnap.id;
      li.style.cursor = "pointer";
      li.onclick = ()=>abrirChamado(docSnap.id);
      chamadosList.appendChild(li);
    });
  });
}

// Enviar mensagem
btnSend.addEventListener("click", async ()=>{
  if(!conversaIdAtual){ alert("Selecione um chamado"); return; }
  const msg = inputMsg.value.trim();
  if(msg==="") return;
  const mensagensRef = collection(db,"chamados",conversaIdAtual,"mensagens");
  await addDoc(mensagensRef,{
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp()
  });
  inputMsg.value="";
});

// ---------- STATE CHANGE ----------
onAuthStateChanged(auth, async (user)=>{
  if(user){
    loginDiv.style.display="none";
    chatDiv.style.display="flex";
    userEmailSpan.textContent = user.email;

    const userDoc = await getDoc(doc(db,"users",user.email));
    const tipo = userDoc.exists()? userDoc.data().tipo : "cooperado";

    if(tipo==="cooperado"){
      // Cooperado: cria automaticamente seu chamado
      await setDoc(doc(db,"chamados",user.email),{status:"aberto"},{merge:true});
      chamadosListContainer.style.display="none";
      abrirChamado(user.email);
    } else {
      // Atendente: lista todos os chamados
      chamadosListContainer.style.display="block";
      listarChamados();
    }

    btnSend.disabled = false;
    inputMsg.disabled = false;
  } else {
    loginDiv.style.display="block";
    chatDiv.style.display="none";
    conversaIdAtual = null;
  }
});
