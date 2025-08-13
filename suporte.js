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

// ---------- CONFIG FIREBASE ----------
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

// ---------- ELEMENTOS ----------
const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const userEmailSpan = document.getElementById("userEmail");
const chatBox = document.getElementById("chat-box");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");
const chamadosListContainer = document.getElementById("chamadosListContainer");
const chamadosList = document.getElementById("chamadosList");

let conversaIdAtual = null;
let unsubscribeMensagens = null;

// ---------- LOGIN ----------
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert("Erro no login: " + e.message);
  }
});

// ---------- CADASTRO ----------
document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Cadastro realizado!");
    await setDoc(doc(db, "users", email), { tipo: "cooperado" }, { merge: true });
  } catch (e) {
    alert("Erro no cadastro: " + e.message);
  }
});

// ---------- LOGOUT ----------
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  if (unsubscribeMensagens) unsubscribeMensagens();
  conversaIdAtual = null;
  chatBox.innerHTML = "";
  chamadosList.innerHTML = "";
});

// ---------- ABRIR CHAMADO ----------
async function abrirChamado(email) {
  conversaIdAtual = email;
  if (unsubscribeMensagens) unsubscribeMensagens();
  chatBox.innerHTML = "";

  const mensagensRef = collection(db, "chamados", conversaIdAtual, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.textContent = `${data.usuario}: ${data.texto}`;
      chatBox.appendChild(msgEl);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}

// ---------- LISTAR CHAMADOS ----------
function listarChamados() {
  const chamadosRef = collection(db, "chamados");
  onSnapshot(chamadosRef, (snapshot) => {
    chamadosList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const li = document.createElement("li");
      li.textContent = docSnap.id;
      li.style.cursor = "pointer";
      li.onclick = () => abrirChamado(docSnap.id);
      chamadosList.appendChild(li);
    });
  });
}

// ---------- ENVIAR MENSAGEM ----------
btnSend.addEventListener("click", async () => {
  if (!conversaIdAtual) {
    alert("Selecione um chamado");
    return;
  }
  const msg = inputMsg.value.trim();
  if (!msg) return;

  try {
    const mensagensRef = collection(db, "chamados", conversaIdAtual, "mensagens");
    await addDoc(mensagensRef, {
      texto: msg,
      usuario: auth.currentUser.email,
      timestamp: serverTimestamp()
    });
    inputMsg.value = "";
  } catch (e) {
    console.error("Erro ao enviar mensagem:", e);
  }
});

// ---------- VERIFICA LOGIN ----------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    userEmailSpan.textContent = user.email;

    try {
      const userDoc = await getDoc(doc(db, "users", user.email));
      const tipo = userDoc.exists() ? userDoc.data().tipo : "cooperado";
      console.log("Tipo do usuário:", tipo);

      if (tipo === "cooperado") {
        await setDoc(doc(db, "chamados", user.email), { status: "aberto" }, { merge: true });
        chamadosListContainer.style.display = "none";
        abrirChamado(user.email);
      } else {
        chamadosListContainer.style.display = "block";
        listarChamados();
      }
    } catch (e) {
      console.error("Erro ao carregar dados do usuário:", e);
    }
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
    conversaIdAtual = null;
  }
});
