const DRAFT_BUDGET = 1100;

const POSITION_NAMES = {
  GK: "KL",
  RB: "SĞB",
  CB: "STP",
  LB: "SLB",
  DM: "ÖNL",
  CM: "OS",
  CAM: "OOS",
  RW: "SĞA",
  LW: "SLA",
  ST: "ST"
};

async function loadPlayers() {
  const message = document.getElementById("pickerMessage");
  const container = document.getElementById("draftPlayers");

  try {
    const response = await fetch("./players.json");

    if (!response.ok) {
      throw new Error("players.json dosyası bulunamadı.");
    }

    const players = await response.json();

    message.textContent =
      `${players.length} test futbolcusu yüklendi.`;

    container.innerHTML = "";

    players.forEach(player => {
      const card = document.createElement("div");
      card.className = "draft-card";

      const name = document.createElement("h4");
      name.textContent = player.name;

      const position = document.createElement("div");
      position.className = "position-tag";
      position.textContent =
        POSITION_NAMES[player.position] || player.position;

      const rating = document.createElement("div");
      rating.className = "rating";
      rating.textContent = player.rating;

      const fee = document.createElement("p");
      fee.textContent = `${player.fee} M€`;

      card.append(position, name, rating, fee);
      container.appendChild(card);
    });

  } catch (error) {
    message.textContent = error.message;
    container.textContent = "Futbolcu listesi yüklenemedi.";
  }
}

loadPlayers();
