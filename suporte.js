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

const contatosSalvosSelect = document.getElementById("contatosSalvos");

const replyPreview = document.getElementById("replyPreview");
const replyText = document.getElementById("replyText");
const cancelReplyBtn = document.getElementById("cancelReplyBtn");

let conversaIdAtual = null;
let unsubscribeMensagens = null;
let unsubscribeTyping = null;
let digitandoTimeout = null;

let mensagemRespondida = null;

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

function carregarContatos() {
  const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(email => {
      const option = document.createElement("option");
      option.value = email;
      option.textContent = email;
      contatosSalvosSelect.appendChild(option);
    });
  } else {
    contatosSalvosSelect.style.display = "none";
    contatosSalvosSelect.innerHTML = "";
  }
}

contatosSalvosSelect.addEventListener("change", () => {
  const selecionado = contatosSalvosSelect.value;
  if (selecionado) {
    friendEmailInput.value = selecionado;
  } else {
    friendEmailInput.value = "";
  }
});

function salvarContato(email) {
  if (!email) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.includes(email)) {
    contatos.push(email);
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
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
  limparResposta();
});

startChatBtn.addEventListener("click", () => {
  const amigo = friendEmailInput.value.trim().toLowerCase();
  const usuario = auth.currentUser.email.toLowerCase();

  if (amigo === "" || amigo === usuario) {
    alert("Digite um email válido e diferente do seu.");
    return;
  }

  const novaConversaId = gerarIdConversa(usuario, amigo);

  if (conversaIdAtual === novaConversaId) return; 

  conversaIdAtual = novaConversaId;
  abrirConversa(conversaIdAtual);
  btnSend.disabled = false;
  inputMsg.disabled = false;

  salvarContato(amigo);
});

btnSend.addEventListener("click", async () => {
  if (!conversaIdAtual) {
    alert("Abra uma conversa antes de enviar mensagens.");
    return;
  }

  const msg = inputMsg.value.trim();
  if (msg === "") return;

  const mensagensRef = collection(db, "conversas", conversaIdAtual, "mensagens");
  const msgObj = {
    texto: msg,
    usuario: auth.currentUser.email,
    timestamp: serverTimestamp(),
    lidoPor: [auth.currentUser.email]
  };

  if (mensagemRespondida) {
    msgObj.respondeA = {
      id: mensagemRespondida.id,
      texto: mensagemRespondida.texto,
      usuario: mensagemRespondida.usuario
    };
  }

  await addDoc(mensagensRef, msgObj);

  inputMsg.value = "";
  await atualizarDigitando(false);
  limparResposta();
});

inputMsg.addEventListener("input", () => {
  if (!conversaIdAtual) return;
  atualizarDigitando(true);
  resetDigitandoTimeout();
});

inputMsg.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault(); 
    btnSend.click(); 
  }
});

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function tentarLogin() {
  document.getElementById("loginBtn").click();
}

emailInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tentarLogin();
  }
});

passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tentarLogin();
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    userEmailSpan.textContent = user.email;
    btnSend.disabled = true;
    inputMsg.disabled = true;
    carregarContatos();
  } else {
    loginDiv.style.display = "block";
    chatDiv.style.display = "none";
    conversaIdAtual = null;
    if (unsubscribeMensagens) unsubscribeMensagens();
    if (unsubscribeTyping) unsubscribeTyping();
    chatBox.innerHTML = "";
    friendEmailInput.value = "";
    typingIndicator.textContent = "";
    contatosSalvosSelect.style.display = "none";
    contatosSalvosSelect.innerHTML = "";
    limparResposta();
  }
});

function limparResposta() {
  mensagemRespondida = null;
  replyPreview.style.display = "none";
  replyText.textContent = "";
}

cancelReplyBtn.addEventListener("click", () => {
  limparResposta();
});

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) {
    console.log("Desinscrevendo mensagens anteriores");
    unsubscribeMensagens();
  }
  if (unsubscribeTyping) {
    console.log("Desinscrevendo typing anteriores");
    unsubscribeTyping();
  }

  chatBox.innerHTML = "";
  typingIndicator.textContent = "";

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;

      if (!data.lidoPor || !data.lidoPor.includes(auth.currentUser.email)) {
        updateDoc(docSnap.ref, {
          lidoPor: [...(data.lidoPor || []), auth.currentUser.email]
        }).catch(console.error);
      }

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      if (data.respondeA) {
        const quote = document.createElement("div");
        quote.classList.add("quote");
        quote.textContent = `${data.respondeA.usuario}: ${data.respondeA.texto}`;
        msgEl.appendChild(quote);
      }

      const textoMsg = document.createElement("div");
      textoMsg.textContent = data.texto;
      msgEl.appendChild(textoMsg);

      if (data.usuario === auth.currentUser.email) {
        const outros = data.lidoPor.filter(email => email !== auth.currentUser.email);
        const statusEl = document.createElement("div");
        statusEl.classList.add("status");
        statusEl.textContent = outros.length > 0 ? "✓✓ Visto" : "✓ Enviado";
        msgEl.appendChild(statusEl);
      }

      msgEl.addEventListener("click", () => {
        mensagemRespondida = { id, texto: data.texto, usuario: data.usuario };
        replyPreview.style.display = "block";
        replyText.textContent = `${data.usuario}: ${data.texto.length > 30 ? data.texto.substring(0, 30) + "..." : data.texto}`;
        inputMsg.focus();
      });

      chatBox.appendChild(msgEl);
    });

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
