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

function carregarContatos() {
  const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(({email, apelido}) => {
      const option = document.createElement("option");
      option.value = email;
      option.textContent = apelido;
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

function salvarContato(email, apelido) {
  if (!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const apelido = document.getElementById("apelido").value.trim();

  if (!apelido) {
    alert("Por favor, insira seu apelido antes de entrar.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    localStorage.setItem("userApelido", apelido);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const apelido = document.getElementById("apelido").value.trim();

  if (!apelido) {
    alert("Por favor, insira seu apelido antes de cadastrar.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    localStorage.setItem("userApelido", apelido);
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
  localStorage.removeItem("userApelido");
});

startChatBtn.addEventListener("click", async () => {
  const amigoEmail = friendEmailInput.value.trim().toLowerCase();
  const usuarioEmail = auth.currentUser.email.toLowerCase();

  if (amigoEmail === "" || amigoEmail === usuarioEmail) {
    alert("Digite um email válido e diferente do seu.");
    return;
  }

  // Verifica se contato tem apelido salvo
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  let contatoEncontrado = contatos.find(c => c.email === amigoEmail);

  // Se não tem apelido, pede e salva
  if (!contatoEncontrado) {
    const apelidoNovo = prompt("Digite um apelido para esse contato:");
    if (!apelidoNovo) {
      alert("Você precisa informar um apelido para iniciar a conversa.");
      return;
    }
    salvarContato(amigoEmail, apelidoNovo);
    contatoEncontrado = { email: amigoEmail, apelido: apelidoNovo };
  }

  const novaConversaId = gerarIdConversa(usuarioEmail, amigoEmail);

  if (conversaIdAtual === novaConversaId) return;

  conversaIdAtual = novaConversaId;
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

inputMsg.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    btnSend.click();
  }
});

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const apelidoInput = document.getElementById("apelido");

function tentarLogin() {
  document.getElementById("loginBtn").click();
}

[emailInput, passwordInput, apelidoInput].forEach(input => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      tentarLogin();
    }
  });
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    const apelido = localStorage.getItem("userApelido") || user.email;
    userEmailSpan.textContent = apelido;
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
  }
});

async function abrirConversa(conversaId) {
  if (unsubscribeMensagens) {
    unsubscribeMensagens();
  }
  if (unsubscribeTyping) {
    unsubscribeTyping();
  }

  chatBox.innerHTML = "";
  typingIndicator.textContent = "";

  const mensagensRef = collection(db, "conversas", conversaId, "mensagens");
  const q = query(mensagensRef, orderBy("timestamp"));

  unsubscribeMensagens = onSnapshot(q, (snapshot) => {
    chatBox.innerHTML = "";

    let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
    let apelidoUsuario = localStorage.getItem("userApelido") || auth.currentUser.email;

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();

      if (!data.lidoPor || !data.lidoPor.includes(auth.currentUser.email)) {
        updateDoc(docSnap.ref, {
          lidoPor: [...(data.lidoPor || []), auth.currentUser.email]
        }).catch(console.error);
      }

      const msgEl = document.createElement("div");
      msgEl.classList.add("msg");
      msgEl.classList.add(data.usuario === auth.currentUser.email ? "own" : "friend");

      let remetenteApelido = data.usuario;
      const contatoMsg = contatos.find(c => c.email === data.usuario);
      if (contatoMsg) {
        remetenteApelido = contatoMsg.apelido;
      } else if (data.usuario === auth.currentUser.email) {
        remetenteApelido = apelidoUsuario;
      }

      msgEl.textContent = `${remetenteApelido}: ${data.texto}`;

      if (data.usuario === auth.currentUser.email) {
        const outros = data.lidoPor.filter(email => email !== auth.currentUser.email);
        const statusEl = document.createElement("div");
        statusEl.classList.add("status");
        statusEl.textContent = outros.length > 0 ? "✓✓ Visto" : "✓ Enviado";
        msgEl.appendChild(statusEl);
      }

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

    let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
    let apelidoAmigo = amigoEmail;
    const contatoDigitando = contatos.find(c => c.email === amigoEmail);
    if (contatoDigitando) {
      apelidoAmigo = contatoDigitando.apelido;
    }

    if (data[`digitando_${amigoEmail}`]) {
      typingIndicator.textContent = `${apelidoAmigo} está digitando...`;
    } else {
      typingIndicator.textContent = "";
    }
  });
}
