import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc, deleteDoc 
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

// Elementos HTML
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const inputMsg = document.getElementById("novaMensagem");
const btnSend = document.getElementById("enviarBtn");
const btnLogout = document.getElementById("logoutBtn");
const mensagensDiv = document.getElementById("mensagens");
const apelidoLoginInput = document.getElementById("apelidoLogin");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let respostaMsg = null;
let apelidosCache = {};

// Funções utilitárias
function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function carregarApelidosCache() {
  const cacheLocal = localStorage.getItem("apelidosCache");
  apelidosCache = cacheLocal ? JSON.parse(cacheLocal) : {};
}

async function salvarApelido(email, apelido) {
  apelidosCache[email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  try {
    const userDocRef = doc(db, "users", email);
    await setDoc(userDocRef, { nickname: apelido }, { merge: true });
  } catch (error) {
    console.error("Erro ao salvar apelido:", error);
  }
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
    console.error("Erro ao buscar apelido:", error);
  }
  return email;
}

// Função de abrir conversa
async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) unsubscribeMensagens();

  conversaIdAtual = conversaId;
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    mensagensDiv.innerHTML = "";
    const apelidoUsuario = apelidosCache[auth.currentUser.email] || auth.currentUser.email;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      let remetenteApelido = data.usuario === auth.currentUser.email ? apelidoUsuario : await getApelido(data.usuario);

      let textoMsg = data.texto;
      if (data.respondeA) {
        const apelidoResp = await getApelido(data.respondeA.usuario);
        textoMsg = `${apelidoResp}: ${data.respondeA.texto}\n→ ${textoMsg}`;
      }

      msgEl.textContent = textoMsg;

      // 3 pontinhos
      const menuBtn = document.createElement("span");
      menuBtn.textContent = "⋮";
      menuBtn.style.float = "right";
      menuBtn.style.cursor = "pointer";
      menuBtn.style.marginLeft = "10px";

      const menuDiv = document.createElement("div");
      menuDiv.style.position = "absolute";
      menuDiv.style.background = "#fff";
      menuDiv.style.border = "1px solid #ccc";
      menuDiv.style.display = "none";
      menuDiv.style.zIndex = "100";
      menuDiv.style.borderRadius = "5px";
      menuDiv.innerHTML = `
        <div class="menu-item" style="padding:5px;cursor:pointer;">Apagar</div>
        <div class="menu-item" style="padding:5px;cursor:pointer;">Editar</div>
        <div class="menu-item" style="padding:5px;cursor:pointer;">Copiar</div>
      `;

      menuBtn.onclick = (e) => {
        e.stopPropagation();
        menuDiv.style.display = menuDiv.style.display === "block" ? "none" : "block";
      };

      const apagar = menuDiv.children[0];
      const editar = menuDiv.children[1];
      const copiar = menuDiv.children[2];

      apagar.onclick = async (e) => {
        e.stopPropagation();
        if (confirm("Deseja realmente apagar esta mensagem?")) {
          await deleteDoc(doc(db, "conversas", conversaIdAtual, "mensagens", id));
        }
      };

      editar.onclick = () => {
        e.stopPropagation();
        inputMsg.value = data.texto;
        respostaMsg = { id, texto: data.texto, usuario: data.usuario };
        menuDiv.style.display = "none";
      };

      copiar.onclick = () => {
        navigator.clipboard.writeText(data.texto);
        menuDiv.style.display = "none";
      };

      msgEl.style.position = "relative";
      msgEl.appendChild(menuBtn);
      msgEl.appendChild(menuDiv);

      mensagensDiv.appendChild(msgEl);
    }
    mensagensDiv.scrollTop = mensagensDiv.scrollHeight;
  });
}

// Eventos de envio de mensagem
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

  if (respostaMsg) {
    dadosMsg.respondeA = {
      id: respostaMsg.id,
      texto: respostaMsg.texto,
      usuario: respostaMsg.usuario,
    };
  }

  if (respostaMsg && respostaMsg.id) {
    // Editar
    const msgRef = doc(db, "conversas", conversaIdAtual, "mensagens", respostaMsg.id);
    await updateDoc(msgRef, { texto: msg });
  } else {
    await addDoc(mensagensRef, dadosMsg);
  }

  inputMsg.value = "";
  respostaMsg = null;
});

// Logout
btnLogout.addEventListener("click", () => signOut(auth));

// Login
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();
  const apelido = apelidoLoginInput.value.trim();
  if (!email || !senha || !apelido) return alert("Preencha todos os campos");

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    await salvarApelido(email, apelido);
  } catch (err) {
    alert("Erro no login: " + err.message);
  }
});

// Registro
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();
  const apelido = apelidoLoginInput.value.trim();
  if (!email || !senha || !apelido) return alert("Preencha todos os campos");

  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    await salvarApelido(email, apelido);
  } catch (err) {
    alert("Erro no registro: " + err.message);
  }
});

// Autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "block";
    await carregarApelidosCache();
    abrirConversa("global_chat"); // conversa padrão
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
  }
});
