document.addEventListener("DOMContentLoaded", () => {

    const navToggle = document.getElementById("nav-toggle");
    const nav = document.getElementById("main-nav");

    if (navToggle && nav) {
        navToggle.addEventListener("click", () => {
            nav.classList.toggle("active");

            navToggle.innerHTML =
                nav.classList.contains("active") ? "✕" : "☰";
        });
    }

});

const WHATSAPP_NUMBER = "27829080821";

document.addEventListener("DOMContentLoaded", () => {
    updateQuoteCount();
    setupProductPage();
    setupQuoteCartPage();
    setupCustomForm();
    setupCatalogPage();
});

function getQuoteCart() {
    try {
        return JSON.parse(localStorage.getItem("quoteCart")) || [];
    } catch {
        return [];
    }
}

function saveQuoteCart(cart) {
    localStorage.setItem("quoteCart", JSON.stringify(cart));
    updateQuoteCount();
}

function updateQuoteCount() {
    const count = getQuoteCart().reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll("#quote-count").forEach(el => {
        el.innerText = count;
    });
}

function setupProductPage() {
    const productName = document.getElementById("product-name");
    const productImage = document.getElementById("product-img");

    if (!productName || !productImage) return;

    const id = Number(new URLSearchParams(window.location.search).get("id"));

    const loadProducts = window.SITE_PRODUCTS
        ? Promise.resolve(window.SITE_PRODUCTS)
        : fetch("products.json").then(res => res.json());

    loadProducts
        .then(products => {
            const product = products.find(p => p.id === id);

            if (!product) {
                productName.innerText = "Product not found";
                productImage.style.display = "none";
                return;
            }

            productName.innerText = product.name;
            productImage.src = product.image;
            productImage.alt = product.name;
        })
        .catch(() => {
            productName.innerText = "Unable to load product";
            productImage.style.display = "none";
        });
}

function requestProductQuote() {
    sendQuoteForItems([getCurrentProductQuoteItem()]);
}

function addCurrentProductToQuote() {
    addQuoteItem(getCurrentProductQuoteItem());
    const button = document.getElementById("add-product-quote");
    if (button) button.innerText = "Added to Quote";
}

function getCurrentProductQuoteItem() {
    const name = document.getElementById("product-name")?.innerText || "Product";
    const image = document.getElementById("product-img")?.getAttribute("src") || "";
    const size = document.getElementById("size")?.value || "Not selected";
    const color = document.getElementById("color")?.value || "Not selected";
    return {
        key: `product-${new URLSearchParams(window.location.search).get("id") || name}-${size}-${color}`,
        name,
        category: "Clothing",
        size: `Size: ${size}; Colour: ${color}`,
        material: "",
        moq: "",
        image,
        qty: 1
    };
}

function addQuoteItem(item) {
    const cart = getQuoteCart();
    const key = item.key || `${item.source || "site"}-${item.id || item.name}`;
    const existing = cart.find(product => product.key === key);

    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({
            key,
            id: item.id || "",
            name: item.name,
            category: item.category || "",
            description: item.description || "",
            material: item.material || "",
            size: item.size || "",
            moq: item.moq || "",
            image: item.image || "",
            qty: 1
        });
    }

    saveQuoteCart(cart);
}

function setupQuoteCartPage() {
    const list = document.getElementById("quote-items");
    if (!list) return;

    renderQuoteCart();
}

function renderQuoteCart() {
    const list = document.getElementById("quote-items");
    const empty = document.getElementById("quote-empty");
    const actions = document.getElementById("quote-actions");
    if (!list || !empty || !actions) return;

    const cart = getQuoteCart();
    list.innerHTML = "";
    empty.hidden = cart.length > 0;
    actions.hidden = cart.length === 0;

    cart.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "quote-item";
        row.innerHTML = `
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ""}
            <div class="quote-item-main">
                <h2>${item.name}</h2>
                <p>${[item.category, item.description].filter(Boolean).join(" - ")}</p>
                <dl>
                    ${item.material ? `<div><dt>Material</dt><dd>${item.material}</dd></div>` : ""}
                    ${item.size ? `<div><dt>Size</dt><dd>${item.size}</dd></div>` : ""}
                    ${item.moq ? `<div><dt>MOQ</dt><dd>${item.moq}</dd></div>` : ""}
                </dl>
            </div>
            <div class="quote-item-controls">
                <label for="quote-qty-${index}">Qty</label>
                <input id="quote-qty-${index}" type="number" min="1" value="${item.qty}" data-quote-qty="${index}">
                <button type="button" class="secondary-btn" data-remove-quote="${index}">Remove</button>
            </div>
        `;
        list.appendChild(row);
    });

    list.querySelectorAll("[data-quote-qty]").forEach(input => {
        input.addEventListener("change", event => {
            const cart = getQuoteCart();
            const index = Number(event.currentTarget.dataset.quoteQty);
            cart[index].qty = Math.max(1, Number(event.currentTarget.value) || 1);
            saveQuoteCart(cart);
            renderQuoteCart();
        });
    });

    list.querySelectorAll("[data-remove-quote]").forEach(button => {
        button.addEventListener("click", event => {
            const cart = getQuoteCart();
            cart.splice(Number(event.currentTarget.dataset.removeQuote), 1);
            saveQuoteCart(cart);
            renderQuoteCart();
        });
    });
}

function clearQuoteCart() {
    saveQuoteCart([]);
    renderQuoteCart();
}

function sendQuoteCart() {
    const cart = getQuoteCart();
    if (!cart.length) {
        alert("Please add at least one item to your quote list.");
        return;
    }
    sendQuoteForItems(cart);
}

function sendQuoteForItems(items) {
    const lines = items.map((item, index) => {
        const details = [
            item.category ? `Category: ${item.category}` : "",
            item.description ? `Description: ${item.description}` : "",
            item.material ? `Material: ${item.material}` : "",
            item.size ? `Size: ${item.size}` : "",
            item.moq ? `MOQ: ${item.moq}` : "",
            `Quantity needed: ${item.qty || 1}`
        ].filter(Boolean).join("\n   ");

        return `${index + 1}. ${item.name}\n   ${details}`;
    });

    const message = encodeURIComponent(
        `Hi Printology, I would like a quote for:\n\n${lines.join("\n\n")}\n\nMy name:\nBrand / business:\nDelivery area:\nDeadline:\nBranding notes:`
    );
    window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

function setupCustomForm() {
    const form = document.getElementById("customForm");
    if (!form) return;

    form.addEventListener("submit", event => {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const brand = document.getElementById("brand").value.trim() || "Not supplied";
        const product = document.getElementById("product").value;
        const details = document.getElementById("details").value.trim();
        const message = encodeURIComponent(
            `Hi, I'm ${name}\nBrand: ${brand}\nProduct: ${product}\nDetails: ${details}`
        );

        window.location.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    });
}

function setupCatalogPage() {
    const grid = document.getElementById("catalog-grid");
    const search = document.getElementById("catalog-search");
    const category = document.getElementById("catalog-category");
    const count = document.getElementById("catalog-count");

    if (!grid || !search || !category || !count) return;

    const loadProducts = window.CATALOG_PRODUCTS
        ? Promise.resolve(window.CATALOG_PRODUCTS)
        : fetch("catalog-products.json").then(res => res.json());

    loadProducts
        .then(products => {
            const categories = [...new Set(products.map(item => item.category))].sort();
            categories.forEach(name => {
                const option = document.createElement("option");
                option.value = name;
                option.innerText = name;
                category.appendChild(option);
            });

            const params = new URLSearchParams(window.location.search);
            const requestedCategory = grid.dataset.category || params.get("category");
            if (requestedCategory && categories.includes(requestedCategory)) {
                category.value = requestedCategory;
            }

            const render = () => {
                const term = search.value.trim().toLowerCase();
                const selected = category.value;
                const filtered = products.filter(item => {
                    const matchesCategory = selected === "all" || item.category === selected;
                    const haystack = [
                        item.name,
                        item.category,
                        item.description,
                        item.material,
                        item.size,
                        item.moq
                    ].join(" ").toLowerCase();
                    return matchesCategory && haystack.includes(term);
                });

                count.innerText = `${filtered.length} of ${products.length} products`;
                grid.innerHTML = "";

                filtered.forEach(item => {
                    const card = document.createElement("article");
                    card.className = "catalog-card";
                    card.innerHTML = `
                        <img src="${item.image}" alt="${item.name}">
                        <div class="catalog-card-body">
                            <span class="catalog-pill">${item.category}</span>
                            <h2>${item.name}</h2>
                            <p>${item.description || "Custom branded product"}</p>
                            <dl>
                                ${item.material ? `<div><dt>Material</dt><dd>${item.material}</dd></div>` : ""}
                                ${item.size ? `<div><dt>Size</dt><dd>${item.size}</dd></div>` : ""}
                                ${item.moq ? `<div><dt>MOQ</dt><dd>${item.moq}</dd></div>` : ""}
                            </dl>
                            <div class="catalog-actions">
                                <button type="button" class="buy-btn" data-add-quote="${item.id}">Add to Quote</button>
                                <button type="button" class="buy-btn secondary-btn" data-single-quote="${item.id}">Quote This Item</button>
                            </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });

                grid.querySelectorAll("[data-add-quote]").forEach(button => {
                    button.addEventListener("click", event => {
                        const item = products.find(product => product.id === Number(event.currentTarget.dataset.addQuote));
                        addQuoteItem(item);
                        event.currentTarget.innerText = "Added";
                    });
                });

                grid.querySelectorAll("[data-single-quote]").forEach(button => {
                    button.addEventListener("click", event => {
                        const item = products.find(product => product.id === Number(event.currentTarget.dataset.singleQuote));
                        sendQuoteForItems([{ ...item, qty: 1 }]);
                    });
                });
            };

            search.addEventListener("input", render);
            category.addEventListener("change", render);
            render();
        })
        .catch(() => {
            count.innerText = "Catalogue could not be loaded.";
        });
}


