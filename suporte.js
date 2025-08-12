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
const userApelidoSpan = document.getElementById("userApelido");
const userEmailSpan = document.getElementById("userEmail");
const chatBox = document.getElementById("chat-box");
const typingIndicator = document.getElementById("typingIndicator");

const apelidoLoginInput = document.getElementById("apelidoLogin");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const friendApelidoInput = document.getElementById("friendApelido");
const contatosSalvosSelect = document.getElementById("contatosSalvos");
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

function carregarContatos() {
  const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  if (contatos.length > 0) {
    contatosSalvosSelect.style.display = "block";
    contatosSalvosSelect.innerHTML = '<option value="">Escolha um contato</option>';
    contatos.forEach(({email, apelido}) => {
      const option = document.createElement("option");
      option.value = email; // valor = email para usar para abrir conversa
      option.textContent = apelido; // texto = apelido
      contatosSalvosSelect.appendChild(option);
    });
  } else {
    contatosSalvosSelect.style.display = "none";
    contatosSalvosSelect.innerHTML = "";
  }
}

contatosSalvosSelect.addEventListener("change", () => {
  const emailSelecionado = contatosSalvosSelect.value;
  if (emailSelecionado) {
    // encontrar o apelido para preencher no input friendApelido
    const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
    const contato = contatos.find(c => c.email === emailSelecionado);
    if (contato) {
      friendApelidoInput.value = contato.apelido;
    } else {
      friendApelidoInput.value = "";
    }
  } else {
    friendApelidoInput.value = "";
  }
});

function salvarContato(email, apelido) {
  if (!email || !apelido) return;
  let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  email = email.toLowerCase();
  apelido = apelido.trim();

  if (!contatos.some(c => c.email === email)) {
    contatos.push({ email, apelido });
    localStorage.setItem("contatosChat", JSON.stringify(contatos));
    carregarContatos();
  }
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const apelido = apelidoLoginInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!apelido) {
    alert("Por favor, insira seu apelido.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // salvar apelido localmente para mostrar
    localStorage.setItem("userApelido", apelido);
  } catch (error) {
    alert("Erro no login: " + error.message);
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const apelido = apelidoLoginInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!apelido) {
    alert("Por favor, insira seu apelido.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    alert("Cadastro realizado com sucesso! Você já está logado.");
    localStorage.setItem("userApelido", apelido);
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
  friendApelidoInput.value = "";
  contatosSalvosSelect.style.display = "none";
  contatosSalvosSelect.innerHTML = "";
  typingIndicator.textContent = "";
  btnSend.disabled = true;
  inputMsg.disabled = true;
  userApelidoSpan.textContent = "";
  userEmailSpan.textContent = "";
  localStorage.removeItem("userApelido");
});

startChatBtn.addEventListener("click", () => {
  const apelidoAmigo = friendApelidoInput.value.trim();
  if (!apelidoAmigo) {
    alert("Digite o apelido do contato para conversar.");
    return;
  }

  const contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
  const contato = contatos.find(c => c.apelido.toLowerCase() === apelidoAmigo.toLowerCase());

  if (!contato) {
    // Se não encontrar, pode perguntar o email para salvar novo contato
    const emailContato = prompt(`Contato não encontrado. Por favor, informe o email do contato '${apelidoAmigo}':`);
    if (!emailContato) return;

    salvarContato(emailContato, apelidoAmigo);

    abrirConversaComEmail(emailContato);
  } else {
    abrirConversaComEmail(contato.email);
  }
});

function abrirConversaComEmail(email) {
  const usuario = auth.currentUser.email.toLowerCase();

  if (email === usuario) {
    alert("Você não pode abrir conversa consigo mesmo.");
    return;
  }

  const novaConversaId = gerarIdConversa(usuario, email.toLowerCase());

  if (conversaIdAtual === novaConversaId) return;

  conversaIdAtual = novaConversaId;
  abrirConversa(conversaIdAtual);

  btnSend.disabled = false;
  inputMsg.disabled = false;
}

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

// Login com Enter no email, senha e apelido
apelidoLoginInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("loginBtn").click();
  }
});
emailInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("loginBtn").click();
  }
});
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    document.getElementById("loginBtn").click();
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginDiv.style.display = "none";
    chatDiv.style.display = "flex";
    userEmailSpan.textContent = user.email;
    const apelido = localStorage.getItem("userApelido") || user.email;
    userApelidoSpan.textContent = apelido;
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
    friendApelidoInput.value = "";
    contatosSalvosSelect.style.display = "none";
    contatosSalvosSelect.innerHTML = "";
    typingIndicator.textContent = "";
    userApelidoSpan.textContent = "";
    userEmailSpan.textContent = "";
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

      // Mostrar apelido do usuário da mensagem, se estiver salvo nos contatos
      let contatos = JSON.parse(localStorage.getItem("contatosChat")) || [];
      let remetenteApelido = data.usuario;
      const contatoMsg = contatos.find(c => c.email === data.usuario);
      if (contatoMsg) {
        remetenteApelido = contatoMsg.apelido;
      } else if (data.usuario === auth.currentUser.email) {
        remetenteApelido = localStorage.getItem("userApelido") || data.usuario;
      }

      // Criar o conteúdo da mensagem com apelido + texto
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

    if (data[`digitando_${amigoEmail}`]) {
      typingIndicator.textContent = `${localStorage.getItem("contatosChat")?.find(c => c.email === amigoEmail)?.apelido || amigoEmail} está digitando...`;
    } else {
      typingIndicator.textContent = "";
    }
  });
}
