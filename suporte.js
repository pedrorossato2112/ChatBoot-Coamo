import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEDs-1LS6iuem9Pq7BkMwGlQb14vKEM_g",
  authDomain: "chatboot--coamo.firebaseapp.com",
  projectId: "chatboot--coamo",
  storageBucket: "chatboot--coamo.appspot.com",
  messagingSenderId: "328474991416",
  appId: "1:328474991416:web:cd61d9ac5377b6a4ab3fcd",
  measurementId: "G-4QH32PWFM4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const loginDiv = document.getElementById("loginDiv");
const chatDiv = document.getElementById("chatDiv");
const userEmailSpan = document.getElementById("userEmail");
const chatBox = document.getElementById("chat-box");
const typingIndicator = document.getElementById("typingIndicator");

const friendEmailInput = document.getElementById("friendEmail");
const startChatBtn = document.getElementById("startChatBtn");
const inputMsg = document.getElementById("input-msg");
const btnSend = document.getElementById("btn-send");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;

function gerarIdConversa(usuario1, usuario2) {
  return [usuario1, usuario2].sort().join('_');
}

async function atualizarDigitando(status) {
  if (!conversaIdAtual || !auth.currentUser) return;
  const conversaRef = doc(db, "conversas", conversaIdAtual);

  try {
    await setDoc(conversaRef, {
      [`digitando_${auth.currentUser.email}`]: status
    }, { merge: true });
  } catch (error) {
    console.error("Erro ao atualizar digitando:", error);
  }
}

function resetDigitandoTimeout() {
  if (digitandoTimeout) clearTimeout(digitandoTimeout);
  digitandoTimeout = setTimeout(() => {
    atualizarDigitando(false);
  }, 1500);
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Cadastro realizado com sucesso! Você já está logado.");
  } catch (error) {
    alert("Erro no cadastro: " + error.message);
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  if (unsubscribeMensagens) unsubscribeMensagens();
  if (unsubscribeTyping) unsubscribeTyping();
  conversaIdAtual = null;
  chatBox.innerHTML = "";
  friendEmailInput.value = "";
  typingIndicator.textContent = "";
  btnSend.disabled = true;
  inputMsg.disabled = true;
});

startChatBtn.addEventListener("click", () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const usuario = auth.currentUser.email.toLowerCase();

  if (amigo === "" || amigo === usuario) {
    alert("Digite um email válido e diferente do seu.");
    return;
  }

  conversaIdAtual = gerarIdConversa(usuario, amigo);
  abrirConversa(conversaIdAtual);
  btnSend.disabled = false;
  inputMsg.disabled = false;
});

btnSend.addEventListener("click", async () => {
  if (!conversaIdAtual) {
    alert("Abra uma conversa antes de enviar mensagens.");
    return;
  }

  const msg = inputMsg.value.trim();
  if (msg === "") return;

  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  await addDoc(mensagensRef, {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
    lidoPor: [auth.currentUser.email]
  });

  inputMsg.value = "";
  await atualizarDigitando(false);
});

inputMsg.addEventListener("input", () => {
  if (!conversaIdAtual) return;
  atualizarDigitando(true);
  resetDigitandoTimeout();
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    userEmailSpan.textContent = user.email;
    btnSend.disabled = true;
    inputMsg.disabled = true;
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
    conversaIdAtual = null;
    if (unsubscribeMensagens) unsubscribeMensagens();
    if (unsubscribeTyping) unsubscribeTyping();
    chatBox.innerHTML = "";
    friendEmailInput.value = "";
    typingIndicator.textContent = "";
  }
});

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) unsubscribeMensagens();
  if (unsubscribeTyping) unsubscribeTyping();

  chatBox.innerHTML = "";
  typingIndicator.textContent = "";

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, async (snapshot) => {
    chatBox.innerHTML = "";

    // Use for...of para lidar com async await dentro do loop
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      if (!data.lidoPor || !data.lidoPor.includes(auth.currentUser.email)) {
        await updateDoc(docSnap.ref, {
          lidoPor: [...(data.lidoPor || []), auth.currentUser.email]
        });
      }

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      msgEl.textContent = data.texto;

      if (data.usuario === auth.currentUser.email) {
        const outros = data.lidoPor.filter(email => email !== auth.currentUser.email);
        const statusEl = document.createElement("div");
        statusEl.classList.add("status");
        statusEl.textContent = outros.length > 0 ? "✓✓ Visto" : "✓ Enviado";
        msgEl.appendChild(statusEl);
      }

      chatBox.appendChild(msgEl);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  const conversaDoc = doc(db, "conversas", conversaId);

  unsubscribeTyping = onSnapshot(conversaDoc, (docSnap) => {
    if (!docSnap.exists()) {
      setDoc(conversaDoc, {
        [`digitando_${auth.currentUser.email}`]: false
      }, { merge: true });
      typingIndicator.textContent = "";
      return;
    }

    const data = docSnap.data();
    console.log("Status digitando recebido:", data);

    const usuarioAtual = auth.currentUser.email;

    const usuarios = conversaId.split('_');
    const amigoEmail = usuarios.find(email => email !== usuarioAtual);

    if (data[`digitando_${amigoEmail}`]) {
      typingIndicator.textContent = `${amigoEmail} está digitando...`;
    } else {
      typingIndicator.textContent = "";
    }
  });
}
