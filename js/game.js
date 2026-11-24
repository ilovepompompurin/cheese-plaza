const playerDirections = new Map();

// Character artwork
const characterImage = new Image();
characterImage.src = "/assets/characters/base.png";

// Shopping District background
const townImage = new Image();
townImage.src = "/assets/maps/town.png";

// Cane's Threads dressing room background
const clothingRoomImage = new Image();
clothingRoomImage.src = "/assets/maps/shops/clothing-room.png";
// Clothing catalog artwork
const clothingCatalogImg = new Image();
clothingCatalogImg.src = "/assets/ui/clothing-catalog.png";
// Custom Buy/Equip button artwork
const clothingButtonsImg = new Image();
clothingButtonsImg.src = "/assets/ui/clothing-buttons.png";
// Cane's Threads NPC

const caneDialogue = [
  "Hellooo Darling! You look fabulous today!",
  "Looking for something spicy or sweet? I have both!",
  "Come back again Darling! *giggles*",
];

let caneDialogueIndex = 0;

const clothingNPC = new Image();
clothingNPC.src = "/assets/npcs/clothing-shopkeeper.png";

// Clothing catalog data
const clothingCatalog = [
  {
    id: "outfit1",
    name: "Outfit 1",
    price: 50,
    image: "/assets/catalog/clothing/outfit1.png",
  },
  {
    id: "outfit2",
    name: "Outfit 2",
    price: 75,
    image: "/assets/catalog/clothing/outfit2.png",
  },
  {
    id: "outfit3",
    name: "Outfit 3",
    price: 100,
    image: "/assets/catalog/clothing/outfit3.png",
  },

  {
    id: "outfit4",
    name: "Outfit 4",
    price: 125,
    image: "/assets/catalog/clothing/outfit4.png",
  },
  {
    id: "outfit5",
    name: "Outfit 5",
    price: 150,
    image: "/assets/catalog/clothing/outfit5.png",
  },
  {
    id: "outfit6",
    name: "Outfit 6",
    price: 175,
    image: "/assets/catalog/clothing/outfit6.png",
  },
  {
    id: "outfit7",
    name: "Outfit 7",
    price: 200,
    image: "/assets/catalog/clothing/outfit7.png",
  },
  {
    id: "outfit8",
    name: "Outfit 8",
    price: 225,
    image: "/assets/catalog/clothing/outfit8.png",
  },
  {
    id: "outfit9",
    name: "Outfit 9",
    price: 250,
    image: "/assets/catalog/clothing/outfit9.png",
  },
];
// Clothing catalog pagination
let clothingPage = 0;
const clothingItemsPerPage = 9;
function renderClothingCatalog() {
  const container = $("clothingItems");
  container.innerHTML = "";

  $("shopCoins").textContent = coins;

  // Display only 9 clothing items per page
  const startIndex = clothingPage * clothingItemsPerPage;
  const pageItems = clothingCatalog.slice(
    startIndex,
    startIndex + clothingItemsPerPage,
  );

  pageItems.forEach((item) => {
    const owned = ownedClothes.includes(item.id);

    const card = document.createElement("div");
    card.className = "clothing-item";

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;

    const info = document.createElement("div");
    info.className = "clothing-item-info";

    const name = document.createElement("strong");
    name.textContent = item.name;

    const price = document.createElement("p");
    price.textContent = owned ? "Owned" : `${item.price} Cheese`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = owned ? "Sell" : "Try On";
    button.disabled = false;

    button.onclick = () => {
      const isOwned = ownedClothes.includes(item.id);

      if (isOwned) {
        const refund = Math.floor(item.price * 0.5);

        // Prepare Cane's selling offer
        window.caneSellItem = {
          id: item.id,
          name: item.name,
          price: item.price,
          refund: refund,
        };

        window.canePurchaseMessage = `🐭 Cane: Would you like to sell that for ${refund} Cheese?`;

        // Open Cane's existing speech bubble
        const rect = canvas.getBoundingClientRect();

        canvas.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            clientX: rect.left + (800 / 1000) * rect.width,
            clientY: rect.top + (350 / 600) * rect.height,
          }),
        );

        return;
      }

      // Temporarily try on an unowned outfit
      if (me) {
        me.shirt = item.id;
      }

      window.tryOnOutfit = item.id;
      window.tryOnItem = {
        id: item.id,
        name: item.name,
        price: item.price,
      };
      // Prepare Cane's purchase offer
      window.canePurchaseMessage = `🐭 Cane: Splendid Darling! Would you like to buy it for ${item.price} Cheese?`;
      // Automatically open Cane's dialogue
      const npcClickX = 800;
      const npcClickY = 350;

      canvas.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX:
            canvas.getBoundingClientRect().left +
            (npcClickX / 1000) * canvas.getBoundingClientRect().width,
          clientY:
            canvas.getBoundingClientRect().top +
            (npcClickY / 600) * canvas.getBoundingClientRect().height,
        }),
      );
      console.log(`Trying on ${item.name} for ${item.price} Cheese`);
    };

    info.append(name, price);
    card.append(image, info, button);
    container.appendChild(card);
  });
}

// Shopping District building entrances
const shopEntrances = [
  {
    id: "cafe",
    name: "Cheese Café",
    x: 79,
    y: 352,
    width: 156,
    height: 111,
  },
  {
    id: "furniture",
    name: "Whiskers",
    x: 529,
    y: 339,
    width: 64,
    height: 129,
  },
  {
    id: "clothing",
    name: "Cane's Threads",
    x: 683,
    y: 332,
    width: 71,
    height: 121,
  },
];

let nearbyShop = null;

// Detect whether the player is at a shop entrance
function checkShopEntrance() {
  if (!me || area !== "town" || currentShop === "clothing") {
    nearbyShop = null;
    return;
  }

  const shop = shopEntrances.find((entrance) => {
    return (
      me.x >= entrance.x &&
      me.x <= entrance.x + entrance.width &&
      me.y >= entrance.y &&
      me.y <= entrance.y + entrance.height
    );
  });

  // Only trigger when entering a new doorway
  if (shop && nearbyShop !== shop.id) {
    nearbyShop = shop.id;

    console.log(`You are at ${shop.name}!`);

    if (shop.id === "clothing") {
      keys.clear();
      target = null;

      // Switch to Cane's Threads
      currentShop = "clothing";
      document.body.classList.add("in-clothing-shop");
      renderClothingCatalog();
      const exitButton = document.getElementById("exitShop");

      if (exitButton) {
        exitButton.hidden = false;
      } else {
        console.error("Exit Shop button not found in HTML");
      }
    }
  }

  // Reset when leaving a doorway
  if (!shop) {
    nearbyShop = null;
  }
}

// Load all available outfits
const outfitImages = {};

const availableOutfits = [
  "outfit1",
  "outfit2",
  "outfit3",
  "outfit4",
  "outfit5",
  "outfit6",
  "outfit7",
  "outfit8",
  "outfit9",
];

availableOutfits.forEach((outfit) => {
  const image = new Image();
  image.src = `/assets/clothing/${outfit}.png`;
  outfitImages[outfit] = image;
});

// Custom face artwork
const faceImages = {};

const availableFaces = ["face1", "face2", "face3", "face4"];

// Load all available faces
availableFaces.forEach((face) => {
  const img = new Image();
  img.src = `/assets/characters/faces/${face}.png`;
  faceImages[face] = img;
});

// Canvas used for fur recoloring
const furCanvas = document.createElement("canvas");
const furCtx = furCanvas.getContext("2d");

// Recolor the base character directly
function getColoredFur(color) {
  if (!characterImage.complete || !characterImage.naturalWidth) {
    return null;
  }

  furCanvas.width = characterImage.naturalWidth;
  furCanvas.height = characterImage.naturalHeight;

  // Draw the original grayscale character
  furCtx.drawImage(characterImage, 0, 0);

  // Apply color while preserving shading
  furCtx.globalCompositeOperation = "multiply";
  furCtx.fillStyle = color || "#ffffff";
  furCtx.fillRect(0, 0, furCanvas.width, furCanvas.height);

  // Restore original transparency
  furCtx.globalCompositeOperation = "destination-in";
  furCtx.drawImage(characterImage, 0, 0);

  furCtx.globalCompositeOperation = "source-over";

  return furCanvas;
}

const $ = (id) => document.getElementById(id),
  canvas = $("world"),
  ctx = canvas.getContext("2d");
let session = null,
  players = [],
  me = null,
  keys = new Set(),
  target = null,
  lastSend = 0,
  stream;
let area = "town",
  editing = false,
  selected = "🛋️";
const furniture = [
  "🛋️",
  "🛏️",
  "🪴",
  "📺",
  "🪑",
  "🪞",
  "🧸",
  "🖼️",
  "💡",
  "📚",
  "🧀",
];
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("cheeseProfile") || "{}");
} catch {}
let layout = saved.home || { wall: "#e8c9a7", floor: "#b88c64", items: [] };
function persist() {
  try {
    localStorage.setItem("cheeseProfile", JSON.stringify(saved));
  } catch {}
}
const q = new URLSearchParams(location.search);

/* Automatically open Login after a password reset */
if (q.get("showLogin") === "1") {
  $("loginAccount").click();

  // Remove the parameter without reloading the page
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("showLogin");

  window.history.replaceState(
    null,
    "",
    cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
  );
}

/* Open the password reset form when arriving from an email link */
const passwordResetToken = q.get("resetToken");

/* Remove the reset token from the address bar immediately */
if (passwordResetToken) {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("resetToken");

  window.history.replaceState(
    null,
    "",
    cleanUrl.pathname + cleanUrl.search + cleanUrl.hash,
  );
}

if (passwordResetToken) {
  // Hide the normal Welcome and account screens
  $("welcomeContent").hidden = true;
  $("accountForm").hidden = true;
  $("passwordRecoveryForm").hidden = true;

  // Show the Create New Password screen
  $("newPasswordForm").hidden = false;
}

/* Toggle visibility for each password reset field */
function setupPasswordToggle(buttonId, inputId) {
  const button = $(buttonId);
  const input = $(inputId);

  button.onclick = () => {
    const isVisible = input.type === "text";

    input.type = isVisible ? "password" : "text";
    button.textContent = isVisible ? "👁" : "🙈";
    button.title = isVisible ? "Show password" : "Hide password";
    button.setAttribute(
      "aria-label",
      isVisible ? "Show password" : "Hide password",
    );
  };
}

setupPasswordToggle("toggleNewPassword", "newPassword");
setupPasswordToggle("toggleConfirmPassword", "confirmNewPassword");

/* Submit a new password using a recovery token */
$("saveNewPassword").onclick = async () => {
  const password = $("newPassword").value;
  const confirmation = $("confirmNewPassword").value;
  const message = $("newPasswordMessage");
  const button = $("saveNewPassword");

  message.hidden = false;
  message.textContent = "";

  if (password.length < 12 || password.length > 128) {
    message.textContent = "Password must contain 12–128 characters.";
    return;
  }

  if (password !== confirmation) {
    message.textContent = "Passwords do not match.";
    return;
  }

  if (!passwordResetToken) {
    message.textContent = "Missing password reset link.";
    return;
  }

  button.disabled = true;

  try {
    await api("/account/reset-password", {
      token: passwordResetToken,
      password,
    });

    $("newPassword").value = "";
    $("confirmNewPassword").value = "";

    // Remove the reset token from the address bar
    history.replaceState(null, "", location.pathname);

    message.textContent = "Password updated successfully! You can now log in.";

    button.textContent = "Back to Login";

    button.onclick = () => {
      window.location.href = window.location.origin + "/?showLogin=1";
    };
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};

$("room").value = q.get("room") || "PLAZA";
$("name").value = saved.name || "Guest";
$("color").value = saved.color || "#e9ab76";
async function api(path, data = {}) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, ...data }),
  });
  const out = await res.json();
  if (!res.ok) throw Error(out.error);
  return out;
}

/* Verify and restore the saved Cheese Plaza account */
const savedAccountToken = sessionStorage.getItem("cheeseAccountToken");

if (savedAccountToken) {
  // Keep account controls unavailable until verification finishes
  $("loginAccount").hidden = true;
  $("registerAccount").hidden = true;
  $("logoutAccount").hidden = true;
  $("enter").disabled = true;

  api("/account/session", { token: savedAccountToken })
    .then((result) => {
      if (!result.authenticated) {
        throw new Error("Session expired");
      }

      // Restore the verified account
      $("name").value = result.username;
      $("enter").textContent = "Enter Plaza";

      $("logoutAccount").hidden = false;
    })
    .catch(() => {
      // Remove invalid or expired sessions
      sessionStorage.removeItem("cheeseAccountToken");

      $("loginAccount").hidden = false;
      $("registerAccount").hidden = false;
      $("logoutAccount").hidden = true;

      $("enter").textContent = "Enter plaza as Guest";
    })
    .finally(() => {
      $("enter").disabled = false;
    });
}

/* Securely log out of Cheese Plaza */
$("logoutAccount").onclick = async () => {
  const token = sessionStorage.getItem("cheeseAccountToken");

  // Disconnect the active character from the multiplayer room
  if (session) {
    try {
      await api("/leave");

      if (stream) {
        stream.close();
        stream = null;
      }

      session = null;
      players = [];
      me = null;

      $("join").style.display = "";
      $("status").textContent = "Not connected";
    } catch (error) {
      console.error("Failed to leave room during logout:", error);
      $("error").textContent = "Unable to disconnect from the room.";
      return;
    }
  }

  // Clear the account locally
  sessionStorage.removeItem("cheeseAccountToken");

  // Restore Guest options
  $("loginAccount").hidden = false;
  $("registerAccount").hidden = false;
  $("logoutAccount").hidden = true;

  $("name").value = "Guest";
  $("enter").textContent = "Enter plaza as Guest";
  $("error").textContent = "You have logged out.";

  // Invalidate the old session on the server
  if (token) {
    try {
      await api("/account/logout", { token });
    } catch (error) {
      console.error("Server logout failed:", error);
      $("error").textContent =
        "Logged out locally, but the server session could not be ended.";
    }
  }
};

/* Request a Rat Society password reset email */
$("sendResetLink").onclick = async () => {
  const email = $("recoveryEmail").value.trim();
  const message = $("recoveryMessage");
  const button = $("sendResetLink");

  message.hidden = false;
  message.textContent = "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message.textContent = "Please enter a valid email address.";
    return;
  }

  button.disabled = true;

  try {
    const result = await api("/account/forgot-password", {
      email,
    });

    message.textContent = result.message;
  } catch (error) {
    message.textContent =
      "Unable to process your request. Please try again later.";
  } finally {
    button.disabled = false;
  }
};

/* Open the password recovery window */
$("forgotPasswordButton").onclick = () => {
  $("accountForm").hidden = true;
  $("passwordRecoveryForm").hidden = false;

  $("recoveryEmail").value = "";
  $("recoveryMessage").textContent = "";
  $("recoveryMessage").hidden = true;

  $("recoveryEmail").focus();
};

/* Return to the Login window */
$("cancelRecovery").onclick = () => {
  $("passwordRecoveryForm").hidden = true;
  $("loginAccount").click();
};

/* Open the Cheese Plaza login form */
$("loginAccount").onclick = () => {
  $("accountEmailSection").hidden = true;
  $("accountError").textContent = "";
  $("accountError").hidden = true;
  $("welcomeContent").hidden = true;
  $("accountForm").hidden = false;
  $("accountFormTitle").textContent = "Login";
  $("forgotPasswordButton").hidden = false;
  $("accountSubmit").textContent = "Login";

  $("accountUsername").value = "";
  $("accountPassword").value = "";
  $("accountPassword").type = "password";
  $("togglePassword").textContent = "👁";
  $("togglePassword").title = "Show password";
  $("togglePassword").setAttribute("aria-label", "Show password");
  $("accountPassword").autocomplete = "current-password";

  $("error").textContent = "";
  $("accountUsername").focus();
};

/* Close the account form */
$("accountCancel").onclick = () => {
  $("accountError").textContent = "";
  $("accountError").hidden = true;
  $("welcomeContent").hidden = false;
  $("accountForm").hidden = true;
  $("accountPassword").value = "";
  $("error").textContent = "";
};

/* Toggle password visibility using the eye icon */
$("togglePassword").onclick = () => {
  const passwordInput = $("accountPassword");
  const isVisible = passwordInput.type === "text";

  passwordInput.type = isVisible ? "password" : "text";

  $("togglePassword").textContent = isVisible ? "👁" : "🙈";
  $("togglePassword").title = isVisible ? "Show password" : "Hide password";

  $("togglePassword").setAttribute(
    "aria-label",
    isVisible ? "Show password" : "Hide password",
  );
};

/* Press Enter to submit Login or Register */
["accountUsername", "accountPassword"].forEach((id) => {
  $(id).addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      $("accountSubmit").click();
    }
  });
});

/* Submit Cheese Plaza login or registration */
$("accountSubmit").onclick = async () => {
  const username = $("accountUsername").value.trim();
  const password = $("accountPassword").value;
  const isRegistering = $("accountFormTitle").textContent === "Register";

  const email = $("accountEmail").value.trim().toLowerCase();

  const wasPlayingAsGuest = Boolean(session);
  $("accountError").hidden = false;
  $("accountError").textContent = "";

  if (!username || !password) {
    $("accountError").textContent = "Please enter your username and password.";
    return;
  }

  if (isRegistering) {
    // Validate the registration email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      $("accountError").textContent = "Please enter a valid email address.";
      $("accountError").hidden = false;
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      $("accountError").textContent =
        "Username must be 3–20 letters, numbers, or underscores.";
      return;
    }

    if (password.length < 12 || password.length > 128) {
      $("accountError").textContent =
        "Password must contain 12–128 characters.";
      return;
    }
  }

  const submitButton = $("accountSubmit");
  submitButton.disabled = true;

  try {
    if (isRegistering) {
      await api("/account/register", {
        username,
        email,
        password,
      });
    }

    // Log in after registration, or log in an existing account
    const result = await api("/account/login", {
      username,
      password,
    });

    // Disconnect the Guest character before switching accounts
    if (session) {
      await api("/leave");

      if (stream) {
        stream.close();
        stream = null;
      }

      session = null;
      players = [];
      me = null;
    }

    sessionStorage.setItem("cheeseAccountToken", result.token);

    /* Update account buttons after login */
    $("loginAccount").hidden = true;
    $("registerAccount").hidden = true;
    $("logoutAccount").hidden = false;

    $("name").value = result.account.username;
    $("enter").textContent = "Enter Plaza";

    $("accountPassword").value = "";
    $("accountForm").hidden = true;
    $("welcomeContent").hidden = false;

    // Automatically rejoin if the player was already playing as a Guest
    if (wasPlayingAsGuest) {
      await $("enter").onclick();
    }

    $("accountError").textContent = "";
    $("accountError").hidden = true;

    $("accountError").textContent = isRegistering
      ? "Account created! Click Enter Plaza to join."
      : "Login successful! Click Enter Plaza to join.";
  } catch (error) {
    $("accountError").textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
};

/* Open the Cheese Plaza registration form */
$("registerAccount").onclick = () => {
  $("forgotPasswordButton").hidden = true;
  $("accountEmailSection").hidden = false;
  $("accountError").textContent = "";
  $("accountError").hidden = true;
  $("welcomeContent").hidden = true;
  $("accountForm").hidden = false;
  $("accountFormTitle").textContent = "Register";
  $("accountSubmit").textContent = "Create Account";

  $("accountUsername").value = "";
  $("accountPassword").value = "";

  $("accountPassword").type = "password";
  $("togglePassword").textContent = "👁";
  $("togglePassword").title = "Show password";
  $("togglePassword").setAttribute("aria-label", "Show password");

  $("accountPassword").autocomplete = "new-password";

  $("error").textContent = "";
  $("accountUsername").focus();
};

/* Restore the selected Cheese Plaza room */
const selectedRoom = sessionStorage.getItem("cheeseSelectedRoom");

if (selectedRoom) {
  $("room").value = selectedRoom;
}

$("enter").onclick = async () => {
  try {
    session = await api("/join", {
      name: $("name").value,
      room: $("room").value,
      color: $("color").value,
      hat: saved.hat,
      face: saved.face || "face1",
      shirt: saved.shirt,
      home: layout,

      // Link verified accounts to their multiplayer character
      accountToken: sessionStorage.getItem("cheeseAccountToken") || null,
    });

    // Restore saved biography when joining Cheese Plaza
    const savedBiography = localStorage.getItem("cheeseProfileBio") || "";

    if (savedBiography.trim()) {
      api("/bio", {
        bio: savedBiography.trim(),
      }).catch((error) => {
        console.error("Failed to restore biography:", error);
      });
    }
    saved.name = $("name").value;
    saved.color = $("color").value;
    persist();
    $("join").style.display = "none";
    $("roomLabel").textContent = "Room: " + session.room;
    stream = new EventSource("/events?" + new URLSearchParams(session));
    stream.onopen = () => {
      $("status").textContent = "● Connected";
    };
    stream.onerror = () => {
      $("status").textContent = "Reconnecting…";
    };
    stream.onmessage = (e) => {
      const d = JSON.parse(e.data);
      players = d.players;
      const p = players.find((p) => p.id === session.id);
      if (!me && p) me = { ...p };
      if (!p) {
        stream.close();
        location.reload();
        return;
      }
      $("count").textContent = players.length;
      const list = $("players");
      list.replaceChildren();
      for (const p of players) {
        const el = document.createElement("div");
        el.textContent = "● " + p.name + (p.id === session.id ? " (you)" : "");
        el.style.color = p.color;
        if (p.id !== session.id) {
          const visit = document.createElement("button");
          visit.textContent = "Visit home";
          visit.onclick = () => go(p.id);
          el.append(" ", visit);
        }
        list.append(el);
      }
      const chat = $("chat");
      const sig = JSON.stringify(d.chat);
      if (chat.dataset.sig !== sig) {
        chat.dataset.sig = sig;
        chat.replaceChildren();
        for (const m of d.chat) {
          const el = document.createElement("p"),
            b = document.createElement("b");
          b.textContent = m.name + ": ";
          el.append(b, document.createTextNode(m.text));
          chat.append(el);
        }
        chat.scrollTop = chat.scrollHeight;
      }
    };
  } catch (e) {
    $("error").textContent = e.message;
  }
};
$("invite").onclick = async () => {
  if (!session) return;
  const url = new URL(location.href);
  url.searchParams.set("room", session.room);
  try {
    await navigator.clipboard.writeText(url.href);
    $("invite").textContent = "Link copied!";
  } catch {
    prompt("Copy this invite link:", url.href);
  }
};
$("chatForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("message").value.trim();
  if (text && session) {
    api("/chat", { text }).catch(() => {});
    $("message").value = "";
  }
};
for (const emote of ["👋", "❤️", "😂", "🎉", "🧀"]) {
  const b = document.createElement("button");
  b.textContent = emote;
  b.onclick = () => session && api("/emote", { emote }).catch(() => {});
  $("emotes").append(b);
}
window.addEventListener("keydown", (e) => {
  if (
    editing ||
    $("closet").open ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  )
    return;
  const k = e.key.toLowerCase();
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ].includes(k)
  ) {
    e.preventDefault();
    keys.add(k);
    target = null;
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
canvas.onclick = (e) => {
  const r = canvas.getBoundingClientRect();

  let x = ((e.clientX - r.left) * 1000) / r.width;
  let y = ((e.clientY - r.top) * 600) / r.height;

  // Convert screen coordinates to town coordinates when zoomed
  if (area === "town" && currentShop !== "clothing") {
    const viewWidth = 1000 / cameraZoom;
    const viewHeight = 600 / cameraZoom;

    const cameraX = Math.max(
      0,
      Math.min(1000 - viewWidth, (me?.x ?? 500) - viewWidth / 2),
    );

    const cameraY = Math.max(
      0,
      Math.min(600 - viewHeight, (me?.y ?? 300) - viewHeight / 2),
    );

    x = cameraX + x / cameraZoom;
    y = cameraY + y / cameraZoom;
  }

  // Cane's Threads shopkeeper interaction
  if (currentShop === "clothing") {
    // Pink shopkeeper on the right side of the shop
    if (x >= 700 && x <= 950 && y >= 100 && y <= 570) {
      const dialogue = document.createElement("div");

      // Close the conversation after the third message

      if (window.canePurchaseMessage) {
        // Show Cane's purchase offer instead of regular dialogue
        dialogue.textContent = window.canePurchaseMessage;
      } else {
        // Regular NPC conversation
        if (caneDialogueIndex >= caneDialogue.length) {
          document.querySelector("#gameCanvasWrapper .npc-dialogue")?.remove();
          caneDialogueIndex = 0;
          return;
        }

        dialogue.textContent = "🐭 Cane: " + caneDialogue[caneDialogueIndex];

        caneDialogueIndex++;
      }

      Object.assign(dialogue.style, {
        position: "absolute",

        // Under Cane's face, on the right side

        top: "60%",
        left: "80.5%",
        transform: "none",

        // Responsive dimensions
        width: "19%",
        maxWidth: "none",

        boxSizing: "border-box",
        padding: "clamp(5px, 1.2vw, 12px)",

        // Responsive text
        fontSize: "clamp(8px, 1.7cqw, 24px)",
        lineHeight: "1.3",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        overflow: "visible",

        // Cheese Plaza theme
        background: "rgba(255, 250, 241, 0.65)",
        color: "#7653a0",
        textShadow:
          "0 1px 2px rgba(255, 255, 255, 0.95), 0 0 5px rgba(255, 255, 255, 0.8)",
        border: "2px solid #c9a7eb",
        borderRadius: "12px",
        fontWeight: "bold",
        textAlign: "center",
        zIndex: "100",
      });
      let tail = dialogue.querySelector(".npc-dialogue-tail");

      if (!tail) {
        tail = document.createElement("div");
        tail.className = "npc-dialogue-tail";
        dialogue.appendChild(tail);
      }
      const dialogueTail = document.createElement("div");
      dialogue.appendChild(dialogueTail);
      Object.assign(dialogueTail.style, {
        position: "absolute",
        left: "50%",
        top: "-9px",
        transform: "translateX(-50%) rotate(-45deg)",
        width: "16px",
        height: "16px",
        background: "rgba(255, 250, 241, 0.85)",
        borderTop: "2px solid #c9a7eb",
        borderRight: "2px solid #c9a7eb",
        zIndex: "101",
      });

      const shopWrapper = document.getElementById("gameCanvasWrapper");
      shopWrapper.style.position = "relative";
      shopWrapper.style.containerType = "inline-size";

      shopWrapper.querySelector(".npc-dialogue")?.remove();
      dialogue.className = "npc-dialogue";
      shopWrapper.appendChild(dialogue);
      // Move purchase dialogue higher to fit inside the dressing room
      if (
        window.canePurchaseMessage &&
        (window.tryOnItem || window.caneSellItem)
      ) {
        dialogue.style.top = "51%";
      }

      if (
        window.canePurchaseMessage &&
        (window.tryOnItem || window.caneSellItem)
      ) {
        const choices = document.createElement("div");

        Object.assign(choices.style, {
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "5px",
          marginTop: "8px",
          width: "100%",
        });

        const buyButton = document.createElement("button");
        buyButton.textContent = window.caneSellItem ? "Sell" : "Buy";

        buyButton.onclick = (event) => {
          event.stopPropagation();

          // Handle selling an owned outfit
          if (window.caneSellItem) {
            const item = window.caneSellItem;

            // Prevent selling an outfit twice
            if (!ownedClothes.includes(item.id)) return;

            // Refund Cheese and remove ownership
            coins += item.refund;
            ownedClothes = ownedClothes.filter((id) => id !== item.id);

            localStorage.setItem("cheeseCoins", String(coins));
            localStorage.setItem("ownedClothes", JSON.stringify(ownedClothes));

            // Unequip the outfit if currently wearing it
            if (saved.shirt === item.id) {
              saved.shirt = "none";
              persist();

              if (session) {
                api("/style", {
                  color: saved.color,
                  shirt: "none",
                  hat: saved.hat,
                  face: saved.face || "face1",
                }).catch(console.error);
              }
            }

            if (me && me.shirt === item.id) {
              me.shirt = "none";
            }

            // Clear dialogue and temporary previews
            window.caneSellItem = null;
            window.tryOnItem = null;
            window.tryOnOutfit = null;
            window.canePurchaseMessage = null;

            dialogue.remove();
            renderClothingCatalog();
            return;
          }

          const item = window.tryOnItem;
          if (!item) return;

          // Check the player's Cheese balance
          if (coins < item.price) {
            dialogue.firstChild.textContent = `🐭 Cane: You need ${item.price} Cheese to buy this outfit!`;
            return;
          }

          // Purchase the outfit
          coins -= item.price;
          ownedClothes.push(item.id);

          localStorage.setItem("cheeseCoins", String(coins));
          localStorage.setItem("ownedClothes", JSON.stringify(ownedClothes));

          // Return to the previously equipped outfit
          if (me) me.shirt = saved.shirt || "none";

          // Clear the temporary preview
          window.tryOnOutfit = null;
          window.tryOnItem = null;
          window.canePurchaseMessage = null;

          // Close dialogue and refresh catalog
          dialogue.remove();
          renderClothingCatalog();
        };

        const noButton = document.createElement("button");
        noButton.textContent = "No Thanks";
        noButton.onclick = (event) => {
          event.stopPropagation();
          // Cancel selling without changing ownership or Cheese
          if (window.caneSellItem) {
            window.caneSellItem = null;
            window.canePurchaseMessage = null;

            dialogue.remove();
            return;
          }

          // Remove the temporary outfit preview
          window.tryOnOutfit = null;
          window.tryOnItem = null;
          window.canePurchaseMessage = null;

          // Restore the player's saved outfit
          if (me) {
            me.shirt = saved.shirt || "none";
          }

          // Close Cane's purchase dialogue
          document.querySelector("#gameCanvasWrapper .npc-dialogue")?.remove();
        };

        for (const button of [buyButton, noButton]) {
          Object.assign(button.style, {
            background: "#7653a0",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "6px",
            fontSize: "inherit",
            cursor: "pointer",
          });
        }

        choices.append(buyButton, noButton);
        dialogue.appendChild(choices);
      }

      dialogue.onclick = () => dialogue.remove();

      return;
    }
  }

  if (editing) {
    if (selected === "remove") {
      let best = -1,
        dist = 55;
      layout.items.forEach((i, n) => {
        const d = Math.hypot(i.x - x, i.y - y);
        if (d < dist) {
          dist = d;
          best = n;
        }
      });
      if (best >= 0) layout.items.splice(best, 1);
    } else if (y >= 160 && layout.items.length < 30)
      layout.items.push({ type: selected, x, y });
    saveHome();
    return;
  }

  // Check whether another player's character was clicked
  const clickedPlayer = getClickedPlayer(x, y);

  if (clickedPlayer) {
    target = null;

    // Display the selected player's name
    $("publicProfileName").textContent = clickedPlayer.name;

    $("publicProfileBio").textContent =
      clickedPlayer.bio || "This player hasn't written a biography yet.";

    // Open the public profile
    $("publicProfile").showModal();
    previewPublicPlayer(clickedPlayer);
    return;
  }

  target = { x, y };
};
setInterval(() => session && api("/ping").catch(() => {}), 12000);
window.addEventListener("pagehide", () => {
  if (session) navigator.sendBeacon("/leave", JSON.stringify(session));
});
function rect(x, y, w, h, c, r = 12) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function circle(x, y, r, c) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function label(t, x, y, c = "#334637", size = 17) {
  ctx.font = `bold ${size}px system-ui`;
  ctx.textAlign = "center";
  ctx.fillStyle = c;
  ctx.fillText(t, x, y);
}
function tree(x, y) {
  rect(x - 6, y, 12, 30, "#785a40");
  circle(x, y - 5, 28, "#608e59");
  circle(x - 12, y - 14, 20, "#7aa66b");
  circle(x + 12, y - 14, 20, "#719d61");
}
function building(x, y, w, h, name, emoji) {
  rect(x + 5, y + 8, w, h, "#76916c");
  rect(x, y, w, h, "#f5dfb2");
  rect(x - 8, y - 8, w + 16, 35, "#b97759");
  label(name, x + w / 2, y + 16, "#fff4da");
  rect(x + w / 2 - 22, y + h - 42, 44, 42, "#80604b");
  label(emoji, x + w / 2, y + 62, "#554432", 32);
}

function world() {
  // Display Cane's Threads dressing room
  if (currentShop === "clothing") {
    // 1. Draw dressing-room background
    if (clothingRoomImage.complete && clothingRoomImage.naturalWidth > 0) {
      ctx.drawImage(clothingRoomImage, 0, 0, 1000, 600);
    }

    // 2. Draw clothing catalog
    if (clothingCatalogImg.complete && clothingCatalogImg.naturalWidth > 0) {
      // Draw catalog at its original dimensions
      ctx.drawImage(clothingCatalogImg, 0, 0);
    }

    // 3. Draw shopkeeper over the catalog
    if (clothingNPC.complete && clothingNPC.naturalWidth > 0) {
      ctx.drawImage(clothingNPC, 0, 0, 1000, 600);
    }

    // Display Cheese balance in the top-right corner
    const cheeseBalance =
      document.getElementById("shopCoins")?.textContent ?? "0";

    ctx.save();

    // Currency display background
    ctx.fillStyle = "rgba(40, 35, 30, 0.85)";
    ctx.beginPath();
    ctx.roundRect(840, 20, 140, 50, 12);
    ctx.fill();

    // Currency text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`🧀 ${cheeseBalance}`, 910, 45);

    ctx.restore();

    return;
  }

  // Display Shopping District
  if (townImage.complete && townImage.naturalWidth > 0) {
    ctx.drawImage(townImage, 0, 0, 1000, 600);

    // Show collision zones while testing
    const showCollisionZones = false;

    if (showCollisionZones) {
      ctx.save();

      for (const zone of townCollisions) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.3)";
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;

        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
      }

      ctx.restore();
    }
  }
}

function drawHome(h) {
  rect(0, 0, 1000, 600, h.floor, 0);
  rect(0, 0, 1000, 150, h.wall, 0);
  rect(0, 145, 1000, 10, "#80684d", 0);
  for (let y = 175; y < 600; y += 55) {
    ctx.strokeStyle = "#00000012";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1000, y);
    ctx.stroke();
  }
  rect(90, 25, 115, 90, "#fff3d7");
  rect(98, 33, 99, 74, "#a6dbea");
  rect(145, 33, 5, 74, "#fff3d7", 0);
  rect(98, 68, 99, 5, "#fff3d7", 0);
  for (const i of [...h.items].sort((a, b) => a.y - b.y)) {
    label(i.type, i.x, i.y + 15, "#fff", 52);
  }
}
async function go(a) {
  if (!session) return;
  try {
    await api("/area", { area: a });
    area = a;

    // Close Cane's Threads when changing locations
    currentShop = null;
    document.body.classList.remove("in-clothing-shop");

    // Hide the Exit Shop button
    $("exitShop").hidden = true;

    // Remove Cane's dialogue
    document.querySelector("#gameCanvasWrapper .npc-dialogue")?.remove();

    // Cancel unfinished shop interactions
    window.canePurchaseMessage = null;
    window.caneSellItem = null;
    window.tryOnItem = null;
    window.tryOnOutfit = null;

    // Reset Cane's conversation
    caneDialogueIndex = 0;
    nearbyShop = null;

    editing = false;
    $("editor").hidden = true;
    $("decorate").hidden = a !== session.id;
    target = null;
    keys.clear();

    if (me) {
      if (a === "town") {
        // Shopping District spawn point

        me.x = 500;
        me.y = 520;
      } else {
        // Home spawn point
        me.x = 500;
        me.y = 350;
      }

      me.dirty = true;
    }

    $("areaTitle").textContent =
      a === "town"
        ? "Town square"
        : a === session.id
          ? "My home"
          : (players.find((p) => p.id === a)?.name || "Friend") + "’s home";
  } catch (e) {
    $("status").textContent = e.message;
  }
}
function saveHome() {
  saved.home = layout;
  persist();
  api("/home", { home: layout }).catch(
    (e) => ($("status").textContent = e.message),
  );
}
$("myHome").onclick = () => go(session?.id);
$("town").onclick = () => go("town");
$("decorate").onclick = () => {
  editing = true;
  keys.clear();
  target = null;
  $("editor").hidden = false;
  $("wall").value = layout.wall;
  $("floor").value = layout.floor;
};
$("finish").onclick = () => {
  editing = false;
  $("editor").hidden = true;
};
for (const type of [...furniture, "remove"]) {
  const b = document.createElement("button");
  b.textContent = type === "remove" ? "Remove" : type;
  b.onclick = () => {
    selected = type;
    for (const el of $("furniture").children) el.style.outline = "";
    b.style.outline = "2px solid #f4cd79";
  };
  $("furniture").append(b);
}
$("wall").oninput = () => {
  layout.wall = $("wall").value;
  saveHome();
};
$("floor").oninput = () => {
  layout.floor = $("floor").value;
  saveHome();
};
$("face").addEventListener("change", preview);
function preview() {
  const c = $("preview").getContext("2d");

  // Clear previous preview
  c.clearRect(0, 0, 200, 200);

  const width = 170;
  const height = 170;
  const x = 100 - width / 2;
  const y = 15;

  // Draw base character
  if (characterImage.complete && characterImage.naturalWidth > 0) {
    // Preview customized fur color
    const coloredFur = getColoredFur($("fur").value);

    if (coloredFur) {
      c.drawImage(coloredFur, x, y, width, height);
    }
  }

  // Preview the selected outfit
  const previewOutfit = outfitImages[$("shirt").value];

  if (
    previewOutfit &&
    previewOutfit.complete &&
    previewOutfit.naturalWidth > 0
  ) {
    c.drawImage(previewOutfit, x, y, width, height);
  }

  // Preview selected face
  const faceImage = faceImages[$("face").value];

  if (faceImage && faceImage.complete && faceImage.naturalWidth > 0) {
    c.drawImage(faceImage, x, y, width, height);
  }

  // Draw selected accessory
  c.font = "27px system-ui";
  c.textAlign = "center";

  if ($("hat").value !== "none") {
    c.fillText($("hat").value, 100, 34);
  }
}

/* Draw another player's mouse in their public profile */
function previewPublicPlayer(player) {
  const canvas = $("publicProfilePreview");
  const c = canvas.getContext("2d");

  c.clearRect(0, 0, 200, 200);

  const width = 170;
  const height = 170;
  const x = 100 - width / 2;
  const y = 15;

  // Draw player's fur
  const coloredFur = getColoredFur(player.color || "#e9ab76");

  if (coloredFur) {
    c.drawImage(coloredFur, x, y, width, height);
  }

  // Draw player's outfit
  const outfit = outfitImages[player.shirt];

  if (outfit && outfit.complete && outfit.naturalWidth > 0) {
    c.drawImage(outfit, x, y, width, height);
  }

  // Draw player's face
  const face = faceImages[player.face || "face1"];

  if (face && face.complete && face.naturalWidth > 0) {
    c.drawImage(face, x, y, width, height);
  }

  // Draw player's accessory
  if (player.hat && player.hat !== "none") {
    c.font = "27px system-ui";
    c.textAlign = "center";
    c.fillText(player.hat, 100, 45);
  }
}

{
  const c = $("preview").getContext("2d");
  c.clearRect(0, 0, 200, 110);
  c.fillStyle = $("shirt").value;
  c.beginPath();
  c.ellipse(100, 77, 25, 25, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = $("fur").value;
  for (const [x, y, r] of [
    [80, 38, 13],
    [120, 38, 13],
    [100, 55, 25],
  ]) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = "#232323";
  for (const x of [92, 108]) {
    c.beginPath();
    c.arc(x, 53, 3, 0, Math.PI * 2);
    c.fill();
  }
  c.font = "27px system-ui";
  c.textAlign = "center";
  c.fillText($("hat").value === "none" ? "" : $("hat").value, 100, 34);
}

/* Close another player's public Profile */
$("closePublicProfile").onclick = () => {
  $("publicProfile").close();
};

/* Profile wardrobe navigation */
let wardrobeCategory = "outfits";
let wardrobePage = 0;
const wardrobeItemsPerPage = 4;

/* Switch between wardrobe categories */
document.querySelectorAll("#wardrobeTabs .wardrobe-tab").forEach((button) => {
  button.addEventListener("click", () => {
    wardrobeCategory = button.dataset.category;
    wardrobePage = 0;

    // Highlight the selected bookmark
    document.querySelectorAll("#wardrobeTabs .wardrobe-tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    renderProfileOutfits();
  });
});

/* Profile wardrobe — Previous page */
$("wardrobePrev").onclick = () => {
  if (wardrobePage > 0) {
    wardrobePage--;
    renderProfileOutfits();
  }
};

/* Profile wardrobe — Next page */
$("wardrobeNext").onclick = () => {
  wardrobePage++;
  renderProfileOutfits();
};

/* Display outfits, faces, and accessories in Profile */
function renderProfileOutfits() {
  const grid = $("profileOutfitGrid");
  if (!grid) return;

  grid.innerHTML = "";

  let items = [];
  let selector = null;

  // OUTFITS — purchased items only
  if (wardrobeCategory === "outfits") {
    selector = $("shirt");

    items = [
      { id: "none", name: "No Outfit", image: null },
      ...clothingCatalog.filter((item) => ownedClothes.includes(item.id)),
    ];
  }

  // FACES — display all available face styles
  else if (wardrobeCategory === "faces") {
    selector = $("face");

    items = [
      {
        id: "face1",
        name: "Face 1",
        image: "/assets/characters/faces/face1.png",
      },
      {
        id: "face2",
        name: "Face 2",
        image: "/assets/characters/faces/face2.png",
      },
      {
        id: "face3",
        name: "Face 3",
        image: "/assets/characters/faces/face3.png",
      },
      {
        id: "face4",
        name: "Face 4",
        image: "/assets/characters/faces/face4.png",
      },
    ];
  }

  // ACCESSORIES — use existing accessory options
  else if (wardrobeCategory === "accessories") {
    selector = $("hat");

    items = Array.from(selector.options).map((option) => ({
      id: option.value,
      name: option.value === "none" ? "None" : option.textContent,
      emoji: option.value === "none" ? "✕" : option.textContent,
    }));
  }

  // Show only four items per page
  const totalPages = Math.max(
    1,
    Math.ceil(items.length / wardrobeItemsPerPage),
  );

  wardrobePage = Math.min(wardrobePage, totalPages - 1);

  const start = wardrobePage * wardrobeItemsPerPage;
  const visibleItems = items.slice(start, start + wardrobeItemsPerPage);

  // Create inventory buttons
  for (const item of visibleItems) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-outfit-item";
    button.title = item.name;

    // Highlight current selection
    if (selector.value === item.id) {
      button.classList.add("selected");
    }

    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name;
      button.appendChild(image);
    } else {
      button.textContent = item.emoji || "None";
    }

    // Equip or preview selected item
    button.onclick = () => {
      selector.value = item.id;

      renderProfileOutfits();
      preview();
    };

    grid.appendChild(button);
  }

  // Update page indicator
  $("wardrobePage").textContent = `${wardrobePage + 1} / ${totalPages}`;

  $("wardrobePrev").disabled = wardrobePage === 0;
  $("wardrobeNext").disabled = wardrobePage >= totalPages - 1;
}

/* Show purchased outfits in the Profile dropdown */
function updateProfileOutfits() {
  const dropdown = $("shirt");

  // Remember the currently equipped outfit
  const equipped = saved.shirt || "none";

  // Clear the dropdown
  dropdown.innerHTML = "";

  // Always allow removing an outfit
  dropdown.add(new Option("No outfit", "none"));

  // Add purchased outfits
  for (const item of clothingCatalog) {
    if (ownedClothes.includes(item.id)) {
      dropdown.add(new Option(item.name, item.id));
    }
  }

  // Select the equipped outfit if it's available
  dropdown.value = [...dropdown.options].some(
    (option) => option.value === equipped,
  )
    ? equipped
    : "none";
}

/* Profile biography edit mode */
$("editBio").onclick = () => {
  const bioEditor = $("profileBio");
  const bioDisplay = $("profileBioDisplay");
  const editButton = $("editBio");

  if (bioEditor.hidden) {
    // Enter edit mode
    bioEditor.hidden = false;
    bioDisplay.hidden = true;
    editButton.textContent = "Done Editing";
    bioEditor.focus();
  } else {
    // Return to view mode
    bioEditor.hidden = true;
    bioDisplay.hidden = false;
    bioDisplay.textContent = bioEditor.value.trim() || "No biography yet.";
    editButton.textContent = "Edit Bio";
  }
};

$("dress").onclick = () => {
  if (!session) return;
  $("profilePlayerName").textContent =
    saved.name || session?.name || me?.name || "My Mouse";
  $("fur").value = saved.color || "#e9ab76";
  updateProfileOutfits();
  renderProfileOutfits();
  $("hat").value = saved.hat || "none";
  $("face").value = saved.face || "face1";

  keys.clear();
  target = null;
  // Load the player's saved biography

  // Load saved biography
  const savedBio = localStorage.getItem("cheeseProfileBio") || "";

  $("profileBio").value = savedBio;
  $("profileBioDisplay").textContent = savedBio.trim() || "No biography yet.";

  // Always open Profile in viewing mode
  $("profileBio").hidden = true;
  $("profileBioDisplay").hidden = false;
  $("editBio").textContent = "Edit Bio";

  $("closet").showModal();
  preview();
};

// Leave Cane's Threads
$("closeClothingShop").onclick = () => {
  $("clothingShop").close();

  currentShop = null;
  keys.clear();
  target = null;
};

// Keep shop state synchronized if closed with Escape
$("clothingShop").addEventListener("close", () => {
  currentShop = null;
  keys.clear();
  target = null;
});

for (const id of ["fur", "shirt", "hat"]) $(id).oninput = preview;
$("cancelStyle").onclick = () => $("closet").close();
$("saveStyle").onclick = async () => {
  // Save the player's biography locally
  localStorage.setItem("cheeseProfileBio", $("profileBio").value.trim());

  // Share biography with other players
  if (session) {
    api("/bio", {
      bio: $("profileBio").value.trim(),
    }).catch((error) => {
      console.error("Failed to update biography:", error);
    });
  }

  const data = {
    color: $("fur").value,
    shirt: $("shirt").value,
    hat: $("hat").value,
    face: $("face").value,
  };

  try {
    await api("/style", data);
    Object.assign(saved, data);
    persist();
    $("closet").close();
  } catch (e) {
    $("status").textContent = e.message;
  }
};

/* Find a player clicked in the Shopping District */
function getClickedPlayer(x, y) {
  if (area !== "town" || currentShop === "clothing") {
    return null;
  }

  // Check from nearest rendered player backward
  const visiblePlayers = players
    .filter((p) => p.area === area && p.id !== session?.id)
    .sort((a, b) => b.y - a.y);

  return (
    visiblePlayers.find((p) => {
      const halfWidth = 32;
      const height = 64;

      return (
        x >= p.x - halfWidth &&
        x <= p.x + halfWidth &&
        y >= p.y - height + 20 &&
        y <= p.y + 20
      );
    }) || null
  );
}

function avatar(p) {
  const width = 64;
  const height = 64;

  // Track walking direction
  const previous = playerDirections.get(p.id) || {
    x: p.x,
    facingRight: false,
  };

  if (p.x > previous.x) {
    previous.facingRight = true;
  } else if (p.x < previous.x) {
    previous.facingRight = false;
  }

  // Detect player movement
  const now = performance.now();

  if (p.x !== previous.x || (previous.y !== undefined && p.y !== previous.y)) {
    previous.lastMove = now;
    $("exitShop").onclick = () => {
      document.body.classList.remove("in-clothing-shop");
      // Return to Shopping District
      currentShop = null;

      // Close Cane's dialogue when leaving the shop
      document.querySelector("#gameCanvasWrapper .npc-dialogue")?.remove();

      // Cancel any unfinished purchase or sale
      window.canePurchaseMessage = null;
      window.caneSellItem = null;
      window.tryOnItem = null;
      window.tryOnOutfit = null;

      // Reset Cane's regular conversation
      caneDialogueIndex = 0;

      // Prevent immediately reopening the shop
      nearbyShop = "clothing";

      // Move the player away from the doorway
      if (me) {
        me.x = 800;
        me.y = 500;
        me.dirty = true;
      }

      // Hide exit button
      $("exitShop").hidden = true;

      // Stop movement
      keys.clear();
      target = null;

      console.log("Returned to Shopping District");
    };
  }

  previous.x = p.x;
  previous.y = p.y;

  // Check whether the character is walking

  const isMoving =
    currentShop !== "clothing" && now - (previous.lastMove ?? -Infinity) < 150;

  playerDirections.set(p.id, previous);

  // Hopping animation settings
  const hopHeight = 7;
  const hopSpeed = 5;
  const squashAmount = 0.1;

  // Calculate hopping animation
  const phase = ((now / 1000) * hopSpeed) % 1;

  const hop = isMoving ? 4 * phase * (1 - phase) * hopHeight : 0;

  const squash = isMoving
    ? Math.pow(Math.abs(2 * phase - 1), 12) * squashAmount
    : 0;

  // Dynamic hopping shadow
  const airProgress = Math.min(1, hop / Math.max(1, hopHeight));

  ctx.save();
  ctx.globalAlpha = 0.18 - airProgress * 0.08;
  ctx.fillStyle = "#000";
  ctx.beginPath();

  ctx.ellipse(
    p.x,
    p.y + 18,
    24 - airProgress * 6,
    7 - airProgress * 2,
    0,
    0,
    Math.PI * 2,
  );

  ctx.fill();
  ctx.restore();

  // Draw character artwork
  if (characterImage.complete && characterImage.naturalWidth > 0) {
    ctx.save();

    ctx.translate(p.x, p.y);

    // Apply hopping animation
    ctx.translate(0, 20 - hop);

    // Squash and stretch when landing
    ctx.scale(1 + squash * 0.65, 1 - squash);

    // Keep the animation anchored to the feet
    ctx.translate(0, -20);

    // Always face right inside Cane's Threads
    const facingRight =
      currentShop === "clothing" ? true : previous.facingRight;

    if (facingRight) {
      ctx.scale(-1, 1);
    }

    // Draw customized fur color
    const coloredFur = getColoredFur(p.color);

    if (coloredFur) {
      ctx.drawImage(coloredFur, -width / 2, -height + 20, width, height);
    }

    // Draw the player's equipped clothing
    const equippedOutfit =
      outfitImages[
        currentShop === "clothing" && p.id === session?.id && window.tryOnOutfit
          ? window.tryOnOutfit
          : p.shirt
      ];

    if (
      equippedOutfit &&
      equippedOutfit.complete &&
      equippedOutfit.naturalWidth > 0
    ) {
      ctx.drawImage(equippedOutfit, -width / 2, -height + 20, width, height);
    }

    // Draw face layer
    const faceImage = faceImages[p.face || "face1"];

    if (faceImage && faceImage.complete && faceImage.naturalWidth > 0) {
      ctx.drawImage(faceImage, -width / 2, -height + 20, width, height);
    }

    ctx.restore();
  }

  // Draw accessory
  if (p.hat && p.hat !== "none") {
    label(p.hat, p.x, p.y - 35, "#fff", 25);
  }

  // Hide player name tag inside Cane's Threads
  if (currentShop !== "clothing") {
    label(p.name, p.x, p.y - height, "#28382c", 14);
  }

  // Draw player reactions
  if (p.emote) {
    label(p.emote, p.x, p.y - height - 20, "#fff", 25);
  }
}

let prev = performance.now();

/* Shopping District collision zones */

const townCollisions = [
  // Sky — prevent players from walking above the buildings

  // SKY — Block the entire blue background

  // Top sky
  { x: 0, y: 0, width: 1000, height: 165 },

  // Left edge of the map
  { x: 0, y: 165, width: 45, height: 255 },

  // Sky between Cheese Café and Whiskers
  { x: 305, y: 165, width: 23, height: 245 },

  // Sky between Whiskers and Cane's Threads
  { x: 638, y: 165, width: 12, height: 240 },

  // Right edge of the map
  { x: 980, y: 165, width: 20, height: 255 },

  // Cheese Café — upper building area
  { x: 45, y: 105, width: 260, height: 245 },

  // Left and right sides near the café entrance
  { x: 45, y: 350, width: 35, height: 115 },
  { x: 235, y: 350, width: 70, height: 115 },

  // Whiskers — upper building area
  { x: 328, y: 165, width: 310, height: 175 },

  // Lower building sections, leaving the doorway open
  { x: 328, y: 340, width: 200, height: 120 },
  { x: 590, y: 340, width: 48, height: 115 },

  // Cane's Threads — upper building
  { x: 650, y: 105, width: 330, height: 225 },

  // Lower building walls — leave entrance accessible
  { x: 650, y: 330, width: 33, height: 125 },
  { x: 755, y: 330, width: 225, height: 125 },
];

/* Check whether a position is blocked */
function isTownBlocked(x, y) {
  if (area !== "town" || currentShop === "clothing") {
    return false;
  }

  return townCollisions.some(
    (zone) =>
      x >= zone.x &&
      x <= zone.x + zone.width &&
      y >= zone.y &&
      y <= zone.y + zone.height,
  );
}

function tick(t) {
  const dt = Math.min((t - prev) / 1000, 0.05);
  prev = t;

  checkShopEntrance();

  if (me && currentShop !== "clothing") {
    let dx =
        Number(keys.has("d") || keys.has("arrowright")) -
        Number(keys.has("a") || keys.has("arrowleft")),
      dy =
        Number(keys.has("s") || keys.has("arrowdown")) -
        Number(keys.has("w") || keys.has("arrowup"));
    if (target && !dx && !dy) {
      dx = target.x - me.x;
      dy = target.y - me.y;
      if (Math.hypot(dx, dy) < 5) {
        target = null;
        dx = dy = 0;
      }
    }
    const len = Math.hypot(dx, dy);
    if (len) {
      const nextX = Math.max(25, Math.min(975, me.x + (dx / len) * 170 * dt));
      const nextY = Math.max(25, Math.min(800, me.y + (dy / len) * 170 * dt));

      // Check horizontal movement
      if (!isTownBlocked(nextX, me.y)) {
        me.x = nextX;
      }

      // Check vertical movement
      if (!isTownBlocked(me.x, nextY)) {
        me.y = nextY;
      }
    }
    if (t - lastSend > 85 && (len || me.dirty)) {
      lastSend = t;
      api("/move", { x: me.x, y: me.y }).catch(() => {});
      me.dirty = !!len;
    } else if (len) me.dirty = true;
  }

  // Camera follows the player when zoomed in
  const useTownCamera = area === "town" && currentShop !== "clothing";

  if (useTownCamera) {
    ctx.save();

    // Visible area in original map coordinates
    const viewWidth = 1000 / cameraZoom;
    const viewHeight = 600 / cameraZoom;

    // Center the view on the player
    const cameraX = Math.max(
      0,
      Math.min(1000 - viewWidth, (me?.x ?? 500) - viewWidth / 2),
    );

    const cameraY = Math.max(
      0,
      Math.min(600 - viewHeight, (me?.y ?? 300) - viewHeight / 2),
    );

    // Apply the camera transform
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-cameraX, -cameraY);
  }

  if (area === "town") world();
  else {
    const owner = players.find((p) => p.id === area);
    if (!owner && area !== session?.id) {
      go("town");
      world();
    } else drawHome(area === session?.id ? layout : owner.home);
  }

  // Draw players normally in the Shopping District
  if (currentShop !== "clothing") {
    for (const p of [...players]
      .filter((p) => p.area === area)
      .sort((a, b) => a.y - b.y)) {
      avatar(p.id === session?.id && me ? { ...p, x: me.x, y: me.y } : p);
    }
  }
  // Restore normal canvas coordinates after drawing the town
  if (useTownCamera) {
    ctx.restore();
  }
  // Draw enlarged, stationary player inside Cane's Threads
  if (currentShop === "clothing" && me && session) {
    ctx.save();

    // Move player slightly left and up
    ctx.translate(220, 420);

    const shopScale = 400 / 64;
    ctx.scale(shopScale, shopScale);

    // Force character to face right
    const direction = playerDirections.get(session.id) || {
      x: me.x,
      facingRight: true,
    };

    direction.facingRight = true;
    direction.x = me.x;
    playerDirections.set(session.id, direction);

    // Draw character
    avatar({
      ...me,
      ...saved,
      id: session.id,
      x: 0,
      y: 0,
    });

    ctx.restore();
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

let coins = Number(localStorage.getItem("cheeseCoins") ?? 200);

let ownedClothes;

try {
  ownedClothes = JSON.parse(
    localStorage.getItem("ownedClothes") ?? '["outfit1"]',
  );

  if (!Array.isArray(ownedClothes)) {
    ownedClothes = ["outfit1"];
  }
} catch {
  ownedClothes = ["outfit1"];
}

let currentShop = null;

/* Shopping District camera */
let cameraZoom = 1;
const cameraMinZoom = 1;
const cameraMaxZoom = 2.5;
const cameraZoomStep = 0.15;

/* Zoom button controls */
document.getElementById("zoomIn").addEventListener("click", () => {
  if (currentShop === "clothing") return;

  cameraZoom = Math.min(
    cameraMaxZoom,
    Math.round((cameraZoom + cameraZoomStep) * 100) / 100,
  );
});

document.getElementById("zoomOut").addEventListener("click", () => {
  if (currentShop === "clothing") return;

  cameraZoom = Math.max(
    cameraMinZoom,
    Math.round((cameraZoom - cameraZoomStep) * 100) / 100,
  );
});

/* Reset Shopping District zoom */
document.getElementById("zoomReset").addEventListener("click", () => {
  if (area !== "town" || currentShop === "clothing") return;

  cameraZoom = 1;
});

/* Mouse-wheel zoom for Shopping District */
canvas.addEventListener(
  "wheel",
  (e) => {
    if (area !== "town" || currentShop === "clothing") return;

    e.preventDefault();

    const direction = e.deltaY < 0 ? 1 : -1;

    cameraZoom = Math.max(
      cameraMinZoom,
      Math.min(
        cameraMaxZoom,
        Math.round((cameraZoom + direction * cameraZoomStep) * 100) / 100,
      ),
    );
  },
  { passive: false },
);

/* Toggle in-game Room Chat */
const toggleChatButton = document.getElementById("toggleChat");
const gameChatPanel = document.getElementById("gameChatPanel");

toggleChatButton.onclick = () => {
  gameChatPanel.hidden = !gameChatPanel.hidden;

  toggleChatButton.textContent = "💬";
  toggleChatButton.title = gameChatPanel.hidden
    ? "Open Room Chat"
    : "Close Room Chat";
};

/* Automatically scale the entire Cheese Plaza interface */
function resizeCheesePlaza() {
  const wrapper = document.getElementById("gameScaleArea");
  const game = document.getElementById("gameLayout");

  if (!wrapper || !game) return;

  // Original game layout width
  const baseWidth = 1200;

  // Reset scaling before measuring
  game.style.transform = "none";
  game.style.transformOrigin = "top left";
  game.style.margin = "0";

  const baseHeight = game.scrollHeight;

  // Available browser space
  const availableWidth = wrapper.clientWidth;
  const availableHeight = Math.max(
    100,
    window.innerHeight - wrapper.getBoundingClientRect().top - 20,
  );

  // Scale proportionally without stretching
  const scale = Math.min(
    1,
    availableWidth / baseWidth,
    availableHeight / baseHeight,
  );

  game.style.transform = `scale(${scale})`;

  // Center the scaled interface
  game.style.marginLeft = `${Math.max(0, (availableWidth - baseWidth * scale) / 2)}px`;

  // Make wrapper match the visible scaled height
  wrapper.style.height = `${baseHeight * scale}px`;
}

// Scale when the game loads and when the window changes
window.addEventListener("load", resizeCheesePlaza);
window.addEventListener("resize", resizeCheesePlaza);

resizeCheesePlaza();

/* Cheese Plaza Session menu */
const roomButton = document.getElementById("roomButton");
const roomPanel = document.getElementById("roomPanel");
const roomCodeInput = document.getElementById("roomCodeInput");

/* Show Create Session when the Room Code changes */
const createRoomButton = document.getElementById("createRoomButton");

/* Remember existing rooms to prevent duplicate creation */
let existingRoomCodes = new Set(["PLAZA"]);

/* Create and join the selected room */
createRoomButton.onclick = () => {
  $("roomSave").click();
};

roomCodeInput.addEventListener("input", () => {
  const newRoom = roomCodeInput.value.trim().toUpperCase();
  const currentRoom = session?.room || $("room").value;

  createRoomButton.hidden =
    !newRoom ||
    newRoom === currentRoom.toUpperCase() ||
    existingRoomCodes.has(newRoom);

  /* Show a message when the entered room already exists */
  const roomCodeMessage = document.getElementById("roomCodeMessage");

  roomCodeMessage.hidden =
    !newRoom ||
    newRoom === currentRoom.toUpperCase() ||
    !existingRoomCodes.has(newRoom);
});

roomButton.onclick = async () => {
  roomCodeInput.value = $("room").value;
  createRoomButton.hidden = true;
  roomPanel.hidden = false;
  $("roomCodeMessage").hidden = true;

  const list = $("activeRoomsList");
  list.textContent = "Loading active rooms...";

  try {
    const result = await api("/rooms");

    // Remember which rooms already exist
    existingRoomCodes = new Set(result.rooms.map((room) => room.code));
    // Recheck the entered room after refreshing the list
    roomCodeInput.dispatchEvent(new Event("input"));

    // Update Create Session button visibility
    const enteredRoom = roomCodeInput.value.trim().toUpperCase();
    const currentRoom = session?.room || $("room").value;

    createRoomButton.hidden =
      !enteredRoom ||
      enteredRoom === currentRoom.toUpperCase() ||
      existingRoomCodes.has(enteredRoom);

    list.replaceChildren();

    if (result.rooms.length === 0) {
      list.textContent = "No active rooms.";
      return;
    }

    for (const room of result.rooms) {
      const item = document.createElement("div");
      item.className = "activeRoomItem";

      const info = document.createElement("span");
      info.textContent = `${room.code} — ${room.players} player(s)`;

      const joinButton = document.createElement("button");
      joinButton.type = "button";

      const isCurrentRoom = room.code === session?.room;

      joinButton.textContent = isCurrentRoom ? "Current Room" : "Join";
      joinButton.disabled = isCurrentRoom;

      joinButton.onclick = () => {
        roomCodeInput.value = room.code;
        $("roomSave").click();
      };

      item.append(info, joinButton);
      list.append(item);
    }
  } catch (error) {
    list.textContent = "Unable to load active rooms.";
    console.error(error);
  }
};

/* Refresh the Active Rooms list */
$("refreshRoomsButton").onclick = () => {
  roomButton.click();
};

$("roomCancel").onclick = () => {
  roomPanel.hidden = true;
};

/* Change Cheese Plaza room */
$("roomSave").onclick = async () => {
  const newRoom = $("roomCodeInput")
    .value.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 20);

  if (!newRoom) {
    alert("Please enter a valid room code.");
    return;
  }

  /* Avoid rejoining the room we're already in */
  if (session && newRoom === session.room.toUpperCase()) {
    roomPanel.hidden = true;
    return;
  }

  // Save the selected room for the next join
  sessionStorage.setItem("cheeseSelectedRoom", newRoom);

  // Leave the current room and close its live connection
  if (session) {
    if (stream) {
      stream.close();
      stream = null;
    }

    try {
      await api("/leave");
    } catch (error) {
      console.error("Failed to leave previous room:", error);
      return;
    }
  }
  // Reset the previous multiplayer session
  session = null;
  players = [];
  me = null;

  // Set the new room code
  $("room").value = newRoom;

  // Close the Room window
  roomPanel.hidden = true;

  // Restore the Welcome screen if joining fails
  $("join").style.display = "";

  // Reuse the existing join functionality
  await $("enter").onclick();

  // Update the Active Rooms list after switching
  if (session && session.room === newRoom) {
    $("refreshRoomsButton").click();
  }
};

/* Cheese Plaza Settings window */
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");

settingsButton.onclick = () => {
  roomPanel.hidden = true;
  settingsPanel.hidden = false;

  const isLoggedIn = Boolean(sessionStorage.getItem("cheeseAccountToken"));

  $("settingsAccountTitle").textContent = isLoggedIn
    ? "Account"
    : "Guest Account";

  $("settingsAccountDescription").textContent = isLoggedIn
    ? "Manage your Cheese Plaza account."
    : "Log in to save your progress and access your account.";

  $("settingsLogout").hidden = false;
  $("settingsLogout").textContent = isLoggedIn ? "Log Out" : "Login";
};

$("settingsCancel").onclick = () => {
  settingsPanel.hidden = true;
};

/* Handle Login or Logout from Settings */
$("settingsLogout").onclick = async () => {
  settingsPanel.hidden = true;

  const isLoggedIn = Boolean(sessionStorage.getItem("cheeseAccountToken"));

  if (isLoggedIn) {
    // Registered player: securely log out
    await $("logoutAccount").onclick();
  } else {
    // Guest player: open the existing Login window
    $("join").style.display = "";
    $("loginAccount").click();
  }
};
