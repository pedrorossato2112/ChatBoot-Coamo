import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firebase config
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
const userApelidoDisplay = document.getElementById("userApelidoDisplay");
const chatBox = document.getElementById("chat-box");
const nicknameModal = document.getElementById("nicknameModal");
const nicknameInput = document.getElementById("nicknameInput");
const saveNicknameBtn = document.getElementById("saveNicknameBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let apelidosCache = {};
let respostaMsg = null;

// Funções
function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join("_");
}

async function salvarApelido(apelido) {
  if (!auth.currentUser) return;
  apelidosCache[auth.currentUser.email] = apelido;
  localStorage.setItem("apelidosCache", JSON.stringify(apelidosCache));
  const userDocRef = doc(db, "users", auth.currentUser.email);
  await setDoc(userDocRef, { nickname: apelido }, { merge: true });
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
  } catch (error) {
    console.error("Erro ao buscar apelido:", error);
  }
  return email;
}

function mostrarNicknameModal() {
  nicknameModal.style.display = "flex";
  nicknameInput.value = apelidosCache[auth.currentUser.email] || "";
  nicknameInput.focus();
}

function esconderNicknameModal() {
  nicknameModal.style.display = "none";
}

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) { unsubscribeMensagens(); unsubscribeMensagens = null; }
  conversaIdAtual = conversaId;
  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    chatBox.innerHTML = "";
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const id = docSnap.id;

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      const apelido = await getApelido(data.usuario);
      msgEl.textContent = data.texto;

      // Menu 3 pontinhos
      const menuBtn = document.createElement("span");
      menuBtn.textContent = "⋮";
      menuBtn.classList.add("menu-btn");
      const menuOptions = document.createElement("div");
      menuOptions.classList.add("menu-options");

      const apagarBtn = document.createElement("button");
      apagarBtn.textContent = "Apagar";
      apagarBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteDoc(doc(db, "conversas", conversaId, "mensagens", id));
      };

      const editarBtn = document.createElement("button");
      editarBtn.textContent = "Editar";
      editarBtn.onclick = (e) => {
        e.stopPropagation();
        inputMsg.value = data.texto;
        respostaMsg = { id, usuario: data.usuario, editando: true };
      };

      const copiarBtn = document.createElement("button");
      copiarBtn.textContent = "Copiar";
      copiarBtn.onclick = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(data.texto);
      };

      menuOptions.append(apagarBtn, editarBtn, copiarBtn);
      menuBtn.appendChild(menuOptions);
      msgEl.appendChild(menuBtn);

      menuBtn.onclick = (e) => {
        e.stopPropagation();
        menuOptions.style.display = menuOptions.style.display === "block" ? "none" : "block";
      };

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
  userApelidoDisplay.textContent = apelido;
  esconderNicknameModal();
});

btnSend.addEventListener("click", async () => {
  const msg = inputMsg.value.trim();
  if (!msg || !conversaIdAtual) return;

  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");

  if (respostaMsg?.editando) {
    const msgRef = doc(db, "conversas", conversaIdAtual, "mensagens", respostaMsg.id);
    await updateDoc(msgRef, { texto: msg });
    respostaMsg = null;
  } else {
    await addDoc(mensagensRef, {
      texto: msg,
      usuario: auth.currentUser.email,
      timestamp: serverTimestamp(),
      lidoPor: [auth.currentUser.email]
    });
  }
  inputMsg.value = "";
});

// Autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";

    await carregarApelidosCache();
    const apelido = apelidosCache[user.email] || user.email;
    userApelidoDisplay.textContent = apelido;

    mostrarNicknameModal();
  } else {
    loginDiv.style.display = "flex";
    chatDiv.style.display = "none";
  }
});
