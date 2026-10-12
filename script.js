(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const setup = $("setup");
  const game = $("game");
  const namesInput = $("playerNames");
  const playerCount = $("playerCount");
  const setupMessage = $("setupMessage");
  const startBtn = $("startBtn");
  const phaseBadge = $("phaseBadge");
  const roundLabel = $("roundLabel");
  const gameContent = $("gameContent");
  const gameActions = $("gameActions");

  const ROLE_INFO = {
    Assassino: {
      symbol: "🗡️",
      description:
        "Durante a noite, escolha em segredo uma pessoa para eliminar. Seu objetivo é alcançar o controle da cidade."
    },
    Médico: {
      symbol: "✚",
      description:
        "Durante a noite, escolha uma pessoa viva para proteger. Se ela for atacada, poderá sobreviver. Você pode proteger a si mesmo."
    },
    Detetive: {
      symbol: "⌕",
      description:
        "Durante a noite, investigue uma pessoa. O narrador verá se ela é ou não assassina. Use essa informação com estratégia."
    },
    Cidadão: {
      symbol: "☾",
      description:
        "Você não tem uma ação noturna especial. Observe, converse e ajude a cidade a descobrir quem são os assassinos."
    }
  };

  let state = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getNames() {
    return namesInput.value
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean);
  }

  function setMessage(element, text, success = false) {
    element.textContent = text;
    element.style.color = success
      ? "var(--success)"
      : "var(--danger)";
  }

  function updateCount() {
    const count = getNames().length;

    playerCount.textContent =
      `${count} ${count === 1 ? "jogador" : "jogadores"}`;

    setupMessage.textContent = "";
  }

  namesInput.addEventListener("input", updateCount);

  function shuffle(items) {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
  }

  function makeRoles(count) {
    const specialCount = count <= 10 ? 1 : 2;

    const roles = [
      ...Array(specialCount).fill("Assassino"),
      ...Array(specialCount).fill("Médico"),
      ...Array(specialCount).fill("Detetive")
    ];

    while (roles.length < count) {
      roles.push("Cidadão");
    }

    return shuffle(roles);
  }

  function alivePlayers() {
    return state.players.filter(player => player.alive);
  }

  function playerById(id) {
    return state.players.find(player => player.id === id);
  }

  function showGame(badge, content, buttons = [], roundText = null) {
    phaseBadge.textContent = badge.toUpperCase();

    roundLabel.textContent =
      roundText ?? `Rodada ${state.round}`;

    gameContent.innerHTML = content;
    gameActions.innerHTML = "";

    buttons.forEach(item => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = item.className || "primary";
      button.textContent = item.label;

      button.addEventListener("click", item.onClick);
      gameActions.appendChild(button);
    });

    setup.classList.add("hidden");
    game.classList.remove("hidden");

    game.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function startGame() {
    const names = getNames();

    setupMessage.textContent = "";

    if (names.length < 4) {
      setMessage(
        setupMessage,
        "Adicione pelo menos 4 jogadores."
      );
      return;
    }

    if (names.length > 40) {
      setMessage(
        setupMessage,
        "O limite desta versão é de 40 jogadores."
      );
      return;
    }

    const normalized = names.map(name =>
      name.toLocaleLowerCase("pt-BR")
    );

    if (new Set(normalized).size !== names.length) {
      setMessage(
        setupMessage,
        "Há nomes repetidos. Corrija a lista para continuar."
      );
      return;
    }

    const roles = makeRoles(names.length);

    state = {
      players: names.map((name, index) => ({
        id: index + 1,
        name,
        role: roles[index],
        alive: true
      })),

      round: 0,
      revealIndex: 0,
      nightTargetId: null,
      protectedId: null,
      investigation: null,
      lastNightMessage: "",
      voteTargetId: null,
      winner: null
    };

    renderRevealIntro();
  }

  function renderRevealIntro() {
    showGame(
      "Distribuição de papéis",
      `
        <h2>Os segredos serão revelados</h2>

        <p class="story">
          Cada pessoa verá seu papel individualmente.
          Entreguem o celular ao jogador indicado e não
          deixem os outros olharem para a tela.
        </p>

        <div class="notice">
          <strong>Importante:</strong> depois de ler o próprio
          papel, toque em “Ocultar e passar”. A tela será
          substituída antes de entregar o celular.
        </div>

        <p class="muted">
          Jogadores cadastrados: ${state.players.length}
        </p>
      `,
      [{
        label: "Começar revelação",
        onClick: renderNextRole
      }],
      "Preparação"
    );
  }

  function renderNextRole() {
    if (state.revealIndex >= state.players.length) {
      renderNarratorGuide();
      return;
    }

    const player = state.players[state.revealIndex];

    showGame(
      "Papel secreto",
      `
        <p class="story">
          Entregue o celular somente para:
        </p>

        <div class="role-card">
          <div class="role-symbol">✦</div>
          <h2>${escapeHtml(player.name)}</h2>

          <p class="role-description">
            Toque no botão abaixo quando estiver sozinho
            com a tela para revelar seu papel.
          </p>
        </div>

        <div class="notice">
          Jogador ${state.revealIndex + 1} de
          ${state.players.length}. Não deixe ninguém ver
          sua função.
        </div>
      `,
      [{
        label: "Revelar meu papel",
        onClick: () => renderRole(player)
      }],
      "Preparação"
    );
  }

  function renderRole(player) {
    const info = ROLE_INFO[player.role];

    showGame(
      "Papel secreto",
      `
        <p class="story">
          Este é o seu papel, ${escapeHtml(player.name)}.
          Guarde o segredo.
        </p>

        <div class="role-card">
          <div class="role-symbol">${info.symbol}</div>
          <p class="muted">SEU PAPEL É</p>

          <div class="role-name">
            ${escapeHtml(player.role)}
          </div>

          <p class="role-description">
            ${info.description}
          </p>
        </div>

        <div class="notice">
          <strong>Não revele seu papel.</strong>
          Toque abaixo para ocultar esta tela antes de
          passar o celular.
        </div>
      `,
      [{
        label: "Ocultar e passar o celular",
        onClick: () => {
          state.revealIndex++;
          renderNextRole();
        }
      }],
      "Preparação"
    );
  }

  function renderNarratorGuide() {
    showGame(
      "Preparação concluída",
      `
        <h2>A cidade está pronta</h2>

        <p class="story">
          A distribuição terminou. Entregue o celular ao
          narrador, que conduzirá as fases. Todos devem
          fechar os olhos quando o narrador pedir.
        </p>

        <div class="notice">
          <strong>Modo híbrido:</strong> as conversas e
          ações acontecem presencialmente. O narrador usa
          a tela para registrar escolhas e ler resultados
          sem mostrar informações secretas à cidade.
        </div>

        <p class="muted">
          Pessoas vivas: ${alivePlayers().length}
        </p>
      `,
      [{
        label: "Começar a primeira noite",
        onClick: startNight
      }],
      "Rodada 0"
    );
  }

  function startNight() {
    state.round++;
    state.nightTargetId = null;
    state.protectedId = null;
    state.investigation = null;
    state.lastNightMessage = "";
    state.voteTargetId = null;

    showGame(
      "Noite",
      `
        <div class="role-card">
          <div class="role-symbol">🌑</div>
          <h2>A cidade dorme</h2>
        </div>

        <p class="story">
          Narrador: peça a todos que fechem os olhos.
          Acorde os assassinos para escolherem um alvo;
          depois o médico para escolher quem protegerá;
          por fim, o detetive para investigar alguém.
        </p>

        <div class="notice">
          O narrador registra as escolhas sem revelar
          os papéis. Se houver dois jogadores com o mesmo
          papel especial, eles fazem uma única escolha
          em conjunto.
        </div>
      `,
      [{
        label: "Registrar ação dos assassinos",
        onClick: () => renderNightAction("Assassino")
      }]
    );
  }

  function renderNightAction(role) {
    const alive = alivePlayers();
    let eligible = alive;

    if (role === "Assassino") {
      eligible = alive.filter(
        player => player.role !== "Assassino"
      );
    }

    const title = role === "Assassino"
      ? "Assassinos: escolham um alvo"
      : role === "Médico"
      ? "Médico: escolha quem proteger"
      : "Detetive: escolha quem investigar";

    const instruction = role === "Assassino"
      ? "Narrador: acorde os assassinos. Eles apontam em silêncio para a mesma pessoa. Selecione o alvo abaixo."
      : role === "Médico"
      ? "Narrador: acorde o médico. Ele escolhe uma pessoa viva para proteger nesta noite."
      : "Narrador: acorde o detetive. Ele escolhe uma pessoa viva para investigar. O resultado será mostrado apenas na tela.";

    const choices = eligible.map(player => `
      <button
        type="button"
        class="choice"
        data-player-id="${player.id}"
      >
        <span>${escapeHtml(player.name)}</span>
        <small>Selecionar</small>
      </button>
    `).join("");

    showGame(
      `Ação noturna · ${role}`,
      `
        <h2>${title}</h2>
        <p class="story">${instruction}</p>

        <div class="choice-list">
          ${choices || '<p class="muted">Não há alvos disponíveis.</p>'}
        </div>

        <p id="actionError" class="message" role="status"></p>
      `,
      [
        {
          label: role === "Assassino"
            ? "Confirmar alvo"
            : role === "Médico"
            ? "Confirmar proteção"
            : "Confirmar investigação",
          onClick: () => confirmNightAction(role)
        },
        {
          label: "Pular esta ação",
          className: "secondary",
          onClick: () => skipNightAction(role)
        }
      ]
    );

    gameContent
      .querySelectorAll("[data-player-id]")
      .forEach(button => {
        button.addEventListener("click", () => {
          gameContent
            .querySelectorAll("[data-player-id]")
            .forEach(item => item.classList.remove("selected"));

          button.classList.add("selected");

          const id = Number(button.dataset.playerId);

          if (role === "Assassino") {
            state.nightTargetId = id;
          }

          if (role === "Médico") {
            state.protectedId = id;
          }

          if (role === "Detetive") {
            state.investigation = {
              targetId: id,
              result: null
            };
          }
        });
      });
  }

  function confirmNightAction(role) {
    const selected = role === "Assassino"
      ? state.nightTargetId
      : role === "Médico"
      ? state.protectedId
      : state.investigation?.targetId;

    if (!selected) {
      const error = $("actionError");

      if (error) {
        setMessage(
          error,
          "Selecione uma pessoa ou escolha pular esta ação."
        );
      }

      return;
    }

    if (role === "Assassino") {
      renderNightAction("Médico");
      return;
    }

    if (role === "Médico") {
      renderNightAction("Detetive");
      return;
    }

    const target = playerById(
      state.investigation.targetId
    );

    state.investigation.result =
      target.role === "Assassino";

    renderInvestigationResult();
  }

  function skipNightAction(role) {
    if (role === "Assassino") {
      state.nightTargetId = null;
      renderNightAction("Médico");
      return;
    }

    if (role === "Médico") {
      state.protectedId = null;
      renderNightAction("Detetive");
      return;
    }

    state.investigation = null;
    renderNightOutcome();
  }

  function renderInvestigationResult() {
    const target = playerById(
      state.investigation.targetId
    );

    const isAssassin = state.investigation.result;

    showGame(
      "Resultado secreto",
      `
        <div class="role-card">
          <div class="role-symbol">
            ${isAssassin ? "⚠️" : "⌕"}
          </div>

          <h2>${escapeHtml(target.name)}</h2>

          <p class="role-name">
            ${isAssassin ? "É assassino" : "Não é assassino"}
          </p>

          <p class="role-description">
            Este resultado é secreto. Não mostre a tela
            aos demais jogadores.
          </p>
        </div>
      `,
      [{
        label: "Ocultar resultado e continuar",
        onClick: renderNightOutcome
      }]
    );
  }

  function renderNightOutcome() {
    let message;

    if (!state.nightTargetId) {
      message =
        "Nenhum alvo foi escolhido pelos assassinos nesta noite.";
    } else if (
      state.nightTargetId === state.protectedId
    ) {
      message =
        "A pessoa escolhida foi protegida pelo médico. Ninguém será eliminado nesta noite.";
    } else {
      const target = playerById(state.nightTargetId);

      if (target && target.alive) {
        target.alive = false;
        message =
          `${target.name} foi eliminado durante a noite.`;
      } else {
        message = "Não houve eliminação nesta noite.";
      }
    }

    state.lastNightMessage = message;

    const winner = getWinner();

    if (winner) {
      state.winner = winner;
      renderWinner(winner);
      return;
    }

    showGame(
      "Amanhecer",
      `
        <div class="role-card">
          <div class="role-symbol">🌅</div>
          <h2>A cidade acorda</h2>
        </div>

        <p class="story">${escapeHtml(message)}</p>

        ${state.investigation
          ? '<div class="notice">O detetive recebeu o resultado da investigação em segredo.</div>'
          : ""}

        <h3>Jogadores vivos</h3>

        <div>
          ${alivePlayers().map(player => `
            <span class="player-pill">
              ${escapeHtml(player.name)}
            </span>
          `).join("") || '<span class="muted">Ninguém</span>'}
        </div>

        <p class="story">
          Agora conversem presencialmente, discutam as
          suspeitas e decidam por votação quem deve
          ser eliminado.
        </p>
      `,
      [{
        label: "Ir para votação",
        onClick: renderVoting
      }]
    );
  }

  function renderVoting() {
    const eligible = alivePlayers();

    const choices = eligible.map(player => `
      <button
        type="button"
        class="choice"
        data-vote-id="${player.id}"
      >
        <span>${escapeHtml(player.name)}</span>
        <small>Votar para eliminar</small>
      </button>
    `).join("");

    state.voteTargetId = null;

    showGame(
      "Votação",
      `
        <h2>Quem será expulso da cidade?</h2>

        <p class="story">
          Concluam a discussão e façam a votação presencial.
          O narrador deve selecionar abaixo a pessoa que
          recebeu mais votos. Em caso de empate, escolha
          “Empate / sem eliminação”.
        </p>

        <div class="choice-list">${choices}</div>

        <p id="voteError" class="message" role="status"></p>
      `,
      [
        {
          label: "Confirmar eliminação",
          onClick: confirmVote
        },
        {
          label: "Empate / sem eliminação",
          className: "secondary",
          onClick: () => resolveVote(null)
        }
      ]
    );

    gameContent
      .querySelectorAll("[data-vote-id]")
      .forEach(button => {
        button.addEventListener("click", () => {
          gameContent
            .querySelectorAll("[data-vote-id]")
            .forEach(item => item.classList.remove("selected"));

          button.classList.add("selected");

          state.voteTargetId =
            Number(button.dataset.voteId);
        });
      });
  }

  function confirmVote() {
    if (!state.voteTargetId) {
      const error = $("voteError");

      if (error) {
        setMessage(
          error,
          "Selecione quem foi eliminado ou escolha empate."
        );
      }

      return;
    }

    resolveVote(state.voteTargetId);
  }

  function resolveVote(id) {
    let message =
      "A votação terminou empatada ou a cidade decidiu não eliminar ninguém.";

    if (id !== null) {
      const target = playerById(id);

      if (target && target.alive) {
        target.alive = false;

        message =
          `${target.name} foi eliminado pela votação. ` +
          `Seu papel era ${target.role}.`;
      }
    }

    const winner = getWinner();

    if (winner) {
      state.winner = winner;
      renderWinner(winner);
      return;
    }

    showGame(
      "Resultado da votação",
      `
        <div class="result">
          <strong>Resultado:</strong>
          <p>${escapeHtml(message)}</p>
        </div>

        <h3>Jogadores vivos</h3>

        <div>
          ${alivePlayers().map(player => `
            <span class="player-pill">
              ${escapeHtml(player.name)}
            </span>
          `).join("")}
        </div>

        <p class="story">
          Narrador: confirmem que todos estão prontos
          e iniciem a próxima noite.
        </p>
      `,
      [{
        label: "Começar próxima noite",
        onClick: startNight
      }]
    );
  }

  function getWinner() {
    const alive = alivePlayers();

    const assassins = alive.filter(
      player => player.role === "Assassino"
    ).length;

    const others = alive.length - assassins;

    if (assassins === 0) {
      return "Cidade";
    }

    if (assassins >= others) {
      return "Assassinos";
    }

    return null;
  }

  function renderWinner(winner) {
    const cityWon = winner === "Cidade";

    showGame(
      "Fim de jogo",
      `
        <div class="winner">
          <div class="role-symbol">
            ${cityWon ? "🌕" : "🗡️"}
          </div>

          <h2>
            ${cityWon
              ? "A cidade venceu!"
              : "Os assassinos venceram!"}
          </h2>

          <p class="story">
            ${cityWon
              ? "Todos os assassinos foram descobertos. A cidade pode finalmente dormir em paz."
              : "Os assassinos alcançaram o controle da cidade. A noite pertence a eles."}
          </p>
        </div>

        <h3>Todos os papéis</h3>

        <div class="name-list">
          ${state.players.map(player => `
            <div class="choice">
              <span>
                ${escapeHtml(player.name)}
                ${player.alive ? "" : "†"}
              </span>

              <small>
                ${escapeHtml(player.role)}
                ${player.alive ? "" : " · eliminado"}
              </small>
            </div>
          `).join("")}
        </div>
      `,
      [
        {
          label: "Jogar novamente",
          onClick: resetGame
        },
        {
          label: "Voltar à tela inicial",
          className: "secondary",
          onClick: resetToSetup
        }
      ],
      `Fim · Rodada ${state.round}`
    );
  }

  function resetGame() {
    if (!state) return;

    const names = state.players.map(
      player => player.name
    );

    namesInput.value = names.join("\n");
    updateCount();
    startGame();
  }

  function resetToSetup() {
    state = null;

    game.classList.add("hidden");
    setup.classList.remove("hidden");
    setupMessage.textContent = "";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  startBtn.addEventListener("click", startGame);

  updateCount();
})();