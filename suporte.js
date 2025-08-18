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

// Elementos
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const inputMsg = document.getElementById("novaMensagem");
const btnSend = document.getElementById("enviarBtn");
const friendEmailInput = document.getElementById("friendEmail");
const friendApelidoInput = document.getElementById("friendApelido");
const startChatBtn = document.getElementById("startChatBtn");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
const typingIndicator = document.getElementById("typingIndicator");
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const apelidoLoginInput = document.getElementById("apelidoLogin");
const logoutBtn = document.getElementById("logoutBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;
let apelidosCache = {};
let respostaMsg = null;

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
  } catch (err) {
    console.error("Erro ao salvar apelido:", err);
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
    if (userDocSnap.exists() && userDocSnap.data().nickname) {
      apelidosCache[email] = userDocSnap.data().nickname;
      localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
      return apelidosCache[email];
    }
  } catch (err) {
    console.error("Erro ao buscar apelido:", err);
  }
  return email;
}

// Contatos
function salvarContato(email, apelido) {
  if (!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
  }
  carregarContatos();
}

function carregarContatos() {
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  contatosSalvosSelect.innerHTML = "";
  contatos.forEach(c => {
    const div = document.createElement("div");
    div.classList.add("contato-item");
    div.textContent = c.apelido;
    div.dataset.email = c.email;
    div.addEventListener("click", () => {
      abrirConversa(gerarIdConversa(auth.currentUser.email, c.email));
    });
    contatosSalvosSelect.appendChild(div);
  });
}

// Mensagens
async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) unsubscribeMensagens();
  conversaIdAtual = conversaId;

  const chatBox = document.getElementById("mensagens");
  chatBox.innerHTML = "";

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    chatBox.innerHTML = "";
    const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
    const apelidoUsuario = apelidosCache[auth.currentUser.email] || auth.currentUser.email;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      let remetenteApelido = data.usuario;
      const contatoMsg = contatos.find(c => c.email === data.usuario);
      if (contatoMsg) remetenteApelido = contatoMsg.apelido;
      else if (data.usuario === auth.currentUser.email) remetenteApelido = apelidoUsuario;

      let textoMsg = "";
      if (data.respondeA) {
        const apelidoResposta = await getApelido(data.respondeA.usuario);
        textoMsg += `${apelidoResposta}: ${data.respondeA.texto}\n→ `;
      }
      textoMsg += data.texto;
      msgEl.textContent = textoMsg;

      // Três pontinhos
      const menuDots = document.createElement("div");
      menuDots.classList.add("menu-dots");
      menuDots.innerHTML = "⋮";

      const menuOptions = document.createElement("div");
      menuOptions.classList.add("menu-options");
      menuOptions.innerHTML = `
        <div class="option" data-action="apagar">Apagar</div>
        <div class="option" data-action="editar">Editar</div>
        <div class="option" data-action="copiar">Copiar</div>
      `;
      menuDots.appendChild(menuOptions);
      menuDots.addEventListener("click", (e) => {
        e.stopPropagation();
        menuOptions.style.display = menuOptions.style.display === "block" ? "none" : "block";
      });

      menuOptions.querySelectorAll(".option").forEach(opt => {
        opt.addEventListener("click", async () => {
          const action = opt.dataset.action;
          if (action === "apagar") await deleteDoc(doc(db, "conversas", conversaIdAtual, "mensagens", id));
          if (action === "editar") {
            const novoTexto = prompt("Edite a mensagem:", data.texto);
            if (novoTexto) await updateDoc(doc(db, "conversas", conversaIdAtual, "mensagens", id), { texto: novoTexto });
          }
          if (action === "copiar") navigator.clipboard.writeText(data.texto);
          menuOptions.style.display = "none";
        });
      });

      msgEl.appendChild(menuDots);
      chatBox.appendChild(msgEl);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
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
  };
  if (respostaMsg) {
    dadosMsg.respondeA = respostaMsg;
    respostaMsg = null;
  }

  await addDoc(mensagensRef, dadosMsg);
  inputMsg.value = "";
});

// Login
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();
  const apelido = apelidoLoginInput.value.trim();

  if (!email || !senha || !apelido) return alert("Preencha todos os campos.");
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    await salvarApelido(apelido);
  } catch (err) {
    alert("Erro no login: " + err.message);
  }
});

// Registro
registerBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const senha = passwordInput.value.trim();
  const apelido = apelidoLoginInput.value.trim();

  if (!email || !senha || !apelido) return alert("Preencha todos os campos.");
  try {
    await createUserWithEmailAndPassword(auth, email, senha);
    await salvarApelido(apelido);
  } catch (err) {
    alert("Erro no registro: " + err.message);
  }
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
});

// Auth state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    await carregarApelidosCache();
    userApelidoDisplay.textContent = apelidosCache[user.email] || user.email;
    carregarContatos();
  } else {
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});
