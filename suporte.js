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
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const friendEmailInput = document.getElementById("friendEmail");
const friendApelidoInput = document.getElementById("friendApelido");
const startChatBtn = document.getElementById("startChatBtn");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
const typingIndicator = document.getElementById("typingIndicator");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");
const chatBox = document.getElementById("chat-box");
const respostaBox = document.getElementById("respostaBox");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;
let apelidosCache = {};
let respostaMsg = null;

// Funções auxiliares
function gerarIdConversa(u1, u2){ return [u1, u2].sort().join("_"); }

async function getApelido(email){
  if(!email) return "Anônimo";
  if(apelidosCache[email]) return apelidosCache[email];
  try{
    const docSnap = await getDoc(doc(db,"users",email));
    if(docSnap.exists() && docSnap.data().nickname){
      apelidosCache[email] = docSnap.data().nickname;
      localStorage.setItem("apelidosCache",JSON.stringify(apelidosCache));
      return apelidosCache[email];
    }
  }catch(e){ console.error(e); }
  return email;
}

function salvarContato(email, apelido){
  if(!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if(!contatos.some(c => c.email===email)){
    contatos.push({email, apelido});
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
  }
  carregarContatos();
}

function carregarContatos(){
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if(contatos.length>0){
    contatosSalvosSelect.style.display="block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(c=>{
      const opt = document.createElement("option");
      opt.value = c.email;
      opt.textContent = c.apelido;
      contatosSalvosSelect.appendChild(opt);
    });
  } else { contatosSalvosSelect.style.display="none"; }
}

function atualizarRespostaUI(){
  if(!respostaMsg){ respostaBox.style.display="none"; respostaBox.textContent=""; return; }
  getApelido(respostaMsg.usuario).then(a=>{
    respostaBox.style.display="block";
    respostaBox.innerHTML = `<strong>${a}:</strong> ${respostaMsg.texto} <button id="cancelReplyBtn">×</button>`;
    document.getElementById("cancelReplyBtn").onclick = ()=>{ respostaMsg=null; atualizarRespostaUI(); };
  });
}

// Envio de mensagens
async function enviarMensagem(){
  const msg = inputMsg.value.trim();
  if(!msg || !conversaIdAtual) return;
  const mensagensRef = collection(db,"conversas",conversaIdAtual,"mensagens");
  const dadosMsg = {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
    lidoPor: [auth.currentUser.email]
  };
  if(respostaMsg){
    dadosMsg.respondeA = {id:respostaMsg.id,texto:respostaMsg.texto,usuario:respostaMsg.usuario};
  }
  await addDoc(mensagensRef,dadosMsg);
  inputMsg.value="";
  respostaMsg=null;
  atualizarRespostaUI();
}

// Abrir conversa
async function abrirConversa(conversaId){
  if(unsubscribeMensagens){ unsubscribeMensagens(); unsubscribeMensagens=null; }
  conversaIdAtual = conversaId;
  const q = query(collection(db,"conversas",conversaId,"mensagens"),orderBy("timestamp"));
  unsubscribeMensagens = onSnapshot(q, async snapshot=>{
    chatBox.innerHTML="";
    let contatos = JSON.parse(localStorage.getItem("contatosChat"))||[];
    for(const docSnap of snapshot.docs){
      const data = docSnap.data();
      const id = docSnap.id;
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario===auth.currentUser.email?"own":"friend");
      
      let remetente = contatos.find(c=>c.email===data.usuario)?.apelido || (data.usuario===auth.currentUser.email?apelidosCache[auth.currentUser.email]:data.usuario);
      
      let textoMsg = "";
      if(data.respondeA){
        const apelidoResposta = await getApelido(data.respondeA.usuario);
        textoMsg += `${apelidoResposta}: ${data.respondeA.texto}\n→ `;
      }
      textoMsg += data.texto;
      msgEl.textContent = textoMsg;

      // Menu 3 pontinhos
      const menuBtn = document.createElement("div");
      menuBtn.textContent = "⋮";
      menuBtn.classList.add("msg-options");
      const menu = document.createElement("div");
      menu.classList.add("msg-options-menu");
      ["Apagar","Editar","Copiar"].forEach(op=>{
        const b = document.createElement("button");
        b.textContent=op;
        b.onclick=()=>{
          if(op==="Apagar"){ updateDoc(docSnap.ref,{texto:"Mensagem apagada"}); }
          else if(op==="Editar"){ 
            inputMsg.value=data.texto;
            respostaMsg={id:data.id,texto:data.texto,usuario:data.usuario};
            atualizarRespostaUI();
          }
          else if(op==="Copiar"){ navigator.clipboard.writeText(data.texto); }
          menu.style.display="none";
        };
        menu.appendChild(b);
      });
      menuBtn.onclick=()=>{ menu.style.display = menu.style.display==="block"?"none":"block"; };
      msgEl.appendChild(menuBtn);
      msgEl.appendChild(menu);

      // Responder
      msgEl.onclick=()=>{ respostaMsg={id,texto:data.texto,usuario:data.usuario}; atualizarRespostaUI(); inputMsg.focus(); };

      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop=chatBox.scrollHeight;
  });
}

// Eventos
btnSend.addEventListener("click", enviarMensagem);
startChatBtn.addEventListener("click",()=>{
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const apelido = friendApelidoInput.value.trim();
  if(!amigo || !apelido || amigo===auth.currentUser.email) return alert("Email inválido");
  salvarContato(amigo,apelido);
  abrirConversa(gerarIdConversa(auth.currentUser.email,amigo));
});

// Login/Registro
document.getElementById("loginBtn").addEventListener("click",async()=>{
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("password").value;
  try{ await signInWithEmailAndPassword(auth,email,senha); }catch(e){ alert("Erro no login"); }
});
document.getElementById("registerBtn").addEventListener("click",async()=>{
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("password").value;
  const apelido = document.getElementById("apelidoLogin").value.trim();
  if(!apelido) return alert("Digite um apelido");
  try{
    await createUserWithEmailAndPassword(auth,email,senha);
    await setDoc(doc(db,"users",email),{nickname:apelido});
    apelidosCache[email]=apelido;
    localStorage.setItem("apelidosCache",JSON.stringify(apelidosCache));
  }catch(e){ alert("Erro no registro"); }
});

// Logout
document.getElementById("logoutBtn").addEventListener("click",()=>signOut(auth));

// Autenticação
onAuthStateChanged(auth,user=>{
  if(user){
    loginDiv.style.display="none";
    chatDiv.style.display="flex";
    carregarContatos();
    userApelidoDisplay.textContent=apelidosCache[user.email]||user.email;
  } else {
    loginDiv.style.display="flex";
    chatDiv.style.display="none";
  }
});

// Enter envia mensagem
inputMsg.addEventListener("keydown", e=>{ if(e.key==="Enter") enviarMensagem(); });
