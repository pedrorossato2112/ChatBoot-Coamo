const cumprimentos = {
  "oi": [
    "oi", "oie", "oii", "oiii", "oiiii", "ooi", "oooi", "oooie", "ooii",
    "oi oi", "oi, oi", "oi oi oi", "oieee", "oiie", "oiiee", "oiiiiie",
    "ooiee", "oi tudo bem", "oi, tudo bem?", "oi, td bem?", "oi td bem",
    "oi td", "oi td bom", "oi, beleza?", "oi beleza", "oi, tranquilo?",
    "oi tranquilo", "oi eae", "oi e aí", "eai", "e aí", "eaí", "e aee",
    "eaee", "e aii", "fala", "falae", "fala aí", "fala ai", "falaa",
    "falaaê", "falaa aí", "fala comigo", "fala cmg", "fala chat", "opa",
    "opa oi", "opa tudo certo?", "opa beleza", "opa chat", "opa, bom dia",
    "opa, boa tarde", "opa, boa noite", "opa tudo bom", "opa td bom",
    "opa td bem", "ola", "olá", "olaaa", "olááá", "olaaa", "olaa", 
    "ola chat", "olá chat", "ola tudo bem", "olá tudo bem?", 
    "ola, td bem?", "bom dia", "bom diaa", "booom dia", "bom diaaa",
    "boa tarde", "boaa tarde", "boa tarrrde", "boa tarde chat", 
    "boa noite", "boaaa noite", "boa noit", "boa noitee", 
    "boa noite chat", "e aí, beleza?", "fala, beleza?", 
    "fala, tudo certo?", "cheguei", "cheguei chat", "cheguei!", 
    "alô", "aloo", "alôôô", "alooo", "alou", "alow", "alou chat", "chat", "Opa"
  ]
};

const respostasCumprimentos = [
  "Olá! Como posso te ajudar hoje?",
  "Oi! Em que posso ser útil?",
  "Olá, tudo bem? Vamos começar!",
  "Oi! Pronto para te ajudar."
];

function normalizarMensagem(msg) {
  const mensagem = msg.trim().toLowerCase();
  for (let cumprimento in cumprimentos) {
    if (cumprimentos[cumprimento].includes(mensagem)) {
      return cumprimento;
    }
  }
  return mensagem;
}

function addMessage(sender, text, type) {
  const chat = document.getElementById("chat");
  const messageElement = document.createElement("div");
  messageElement.classList.add("msg", type);
  messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chat.appendChild(messageElement);
  chat.scrollTop = chat.scrollHeight;
}

function clearButtons() {
  const buttons = document.querySelectorAll(".buttons-container");
  buttons.forEach(b => b.remove());
}

function addOptionsButtons(options, callback) {
  clearButtons();
  const chat = document.getElementById("chat");
  const buttonsContainer = document.createElement("div");
  buttonsContainer.classList.add("buttons-container");

  options.forEach(option => {
    const button = document.createElement("button");
    button.classList.add("option-button");
    button.innerText = option.label;
    button.onclick = () => callback(option.value);
    buttonsContainer.appendChild(button);
  });

  chat.appendChild(buttonsContainer);
}

function etapaInicial(topico) {
  addMessage("Você", `Opção escolhida: ${topico}`, "user");

  const resposta = `Certo, você selecionou a opção ${topico}. Escolha abaixo o que deseja:`;
  setTimeout(() => {
    addMessage("Assistente", resposta, "bot");

    const subOptions = [
      { label: "Ajuda", value: "ajuda" },
      { label: "Incidente", value: "Incidente" },
      { label: "Suporte tecnico", value: "Suporte tecnico" },
      { label: "Material Treinamento", value: "Material Treinamento" }
    ];

    addOptionsButtons(subOptions, etapaFinal);
  }, 500);
}

function etapaFinal(opcao) {
  addMessage("Você", `Opção escolhida: ${opcao}`, "user");
  setTimeout(() => {
    addMessage("Assistente", `Você escolheu "${opcao}". Em breve entraremos em contato ou forneceremos mais informações.`, "bot","Sua solicitação foi registrada. Retornaremos o mais rápido possível.");
  }, 500);
}

function sendMessage() {
  const input = document.getElementById("userInput");
  const msg = input.value.trim();
  if (!msg) return;

  const msgNormalizada = normalizarMensagem(msg);

  addMessage("Você", msg, "user");

  if (msgNormalizada === "oi") {
    const resposta = respostasCumprimentos[Math.floor(Math.random() * respostasCumprimentos.length)];
    setTimeout(() => {
      addMessage("Assistente", resposta, "bot");

      const primeiraEtapa = [
        { label: "Recebimento", value: "recebimento" },
        { label: "transporte", value: "transporte" },
        { label: "Expedição", value: "Expedição" },
        { label: "Outros", value: "Outros" }
      ];

      addOptionsButtons(primeiraEtapa, etapaInicial);
    }, 500);
  } else {
    setTimeout(() => {
      addMessage("Assistente", "Desculpe, não entendi. Pode tentar de outra forma?", "bot");
    }, 500);
  }

  input.value = "";
}
document.getElementById("btnAjuda").addEventListener("click", function() {
  window.location.href = "suporte.html";
});


document.getElementById("userInput").addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    sendMessage();
  }
});

function clearChat() {
  document.getElementById("chat").innerHTML = "";
}

function etapaFinal(opcao) {
  addMessage("Você", `Opção escolhida: ${opcao}`, "user");
  setTimeout(() => {
    if (opcao === "Material Treinamento") {
      const materialLink = "http://portal.coamo.com.br/logistica-operacoes/gelog/COAMO%20APPLOG/03%20-%20Treinamentos/GELOG%20-%20APPLOG%20-%20Manual%20de%20Utiliza%C3%A7%C3%A3o%20-%20Coordena%C3%A7%C3%A3o%20Projetos%20Log%C3%ADsticos_R4.pdf";
      addMessage("Assistente", `Aqui está o material de treinamento APPLOG: <a href="${materialLink}" target="_blank">Clique aqui para acessar</a>`, "bot");
    } else {
      addMessage("Assistente", `Você escolheu "${opcao}". Em breve entraremos em contato ou forneceremos mais informações.`, "bot");
    }
  }, 500);
}



