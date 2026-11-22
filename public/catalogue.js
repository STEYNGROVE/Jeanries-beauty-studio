(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const search = byId('search');
  const category = byId('category');
  const dealsOnly = byId('deals-only');
  const grid = byId('products');
  const status = byId('catalogue-status');
  const basket = byId('basket-list');
  const send = byId('send-products');
  const selected = new Set();
  let catalogue;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function activeDeals(productId) {
    const now = Date.now();
    return catalogue.promotions.filter(deal =>
      deal.productId === productId && Date.parse(deal.startsAt) <= now && now < Date.parse(deal.endsAt)
    );
  }

  function renderBasket() {
    basket.replaceChildren();
    const items = catalogue.products.filter(product => selected.has(product.id));
    for (const product of items) {
      const line = element('li', product.name);
      const remove = element('button', 'Remove');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + product.name + ' from basket');
      remove.addEventListener('click', () => {
        selected.delete(product.id);
        renderBasket();
        renderProducts();
        (basket.querySelector('button') || search).focus();
      });
      line.append(remove);
      basket.append(line);
    }
    byId('basket-status').textContent = items.length
      ? items.length + (items.length === 1 ? ' product selected.' : ' products selected.')
      : 'No products selected yet.';
    send.disabled = items.length === 0;
  }

  function renderProducts() {
    const words = search.value.trim().toLowerCase().split(/\s+/);
    const matches = catalogue.products.filter(product => {
      const content = [product.name, product.category, product.sku || ''].join(' ').toLowerCase();
      return words.every(word => content.includes(word)) &&
        (!category.value || product.category === category.value) &&
        (!dealsOnly.checked || activeDeals(product.id).length > 0 || (Number.isInteger(product.referencePriceCents) && (!product.priceValidUntil || Date.now() <= Date.parse(product.priceValidUntil + "T23:59:59+02:00"))));
    });
    grid.replaceChildren();
    status.textContent = matches.length + ' of ' + catalogue.products.length + ' products';
    if (!matches.length) {
      grid.append(element('p', dealsOnly.checked ? 'No matching verified deals are available.' : 'No products match your search.'));
    }
    for (const product of matches) {
      const card = element('article', '', 'commerce-card');
      card.id = 'product-' + product.id;
      const placeholder = () => {
        const art = element('div', '', 'product-category-art');
        const monogram = element('span', 'J', 'media-monogram');
        monogram.setAttribute('aria-hidden', 'true');
        art.append(monogram, element('span', 'Product photo unavailable'));
        return art;
      };
      if (product.image || product.brochurePage) {
        const image = element('img');
        image.alt = product.imageAlt || product.name;
        image.width = 300;
        image.height = 300;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', () => image.replaceWith(placeholder()), { once: true });
        image.src = product.image || ('/catalogues/previews/page-' + String(product.brochurePage).padStart(3,'0') + '.webp');
        card.append(image);
      } else {
        card.append(placeholder());
      }
      card.append(element('small', product.category), element('h3', product.name));
      if (product.imageIsBrochurePage) card.append(element('small', 'Brochure page preview · not an isolated product photo'));
      if (Number.isInteger(product.referencePriceCents)) {
        const expired = product.priceValidUntil && Date.now() > Date.parse(product.priceValidUntil + 'T23:59:59+02:00');
        const money = cents => new Intl.NumberFormat('en-ZA', {style:'currency', currency:'ZAR'}).format(cents / 100);
        card.append(element('p', (expired ? 'Expired November offer: ' : 'November brochure: ') + money(product.referencePriceCents), 'justine-reference-price'));
        if (Number.isInteger(product.regularPriceCents)) card.append(element('small', 'Regular brochure price: ' + money(product.regularPriceCents)));
        if (product.brochurePage) {
          const page = element('a', 'View brochure page ' + product.brochurePage);
          page.href = '/justine-brochure#page=' + product.brochurePage;
          card.append(page);
        }
        card.append(element('small', 'Offer valid 1–30 Nov 2026 · Confirm price and stock with Jeanrie'));
      } else {
        card.append(element('p', 'Price on request', 'justine-reference-price'));
      }
      for (const deal of activeDeals(product.id)) {
        const line = element('p', deal.title + ' · ' + new Intl.NumberFormat('en-ZA', {
          style: 'currency', currency: 'ZAR', maximumFractionDigits: 2,
        }).format(deal.priceCents / 100) + ' · Ends ' + new Intl.DateTimeFormat('en-ZA', {
          dateStyle: 'medium', timeZone: 'Africa/Johannesburg',
        }).format(new Date(Date.parse(deal.endsAt) - 1)));
        card.append(line);
      }
      const toggle = element('button', '', 'button');
      toggle.type = 'button';
      toggle.dataset.product = product.id;
      function updateToggle() {
        const added = selected.has(product.id);
        toggle.textContent = added ? 'Remove from basket' : 'Add to basket';
        toggle.setAttribute('aria-label', toggle.textContent + ': ' + product.name);
        toggle.setAttribute('aria-pressed', String(added));
      }
      toggle.addEventListener('click', () => {
        if (!selected.delete(product.id)) selected.add(product.id);
        updateToggle();
        renderBasket();
      });
      updateToggle();
      card.append(toggle);
      grid.append(card);
    }
  }

  function scheduleDealRefresh() {
    const now = Date.now();
    const next = catalogue.promotions
      .flatMap(deal => [Date.parse(deal.startsAt), Date.parse(deal.endsAt)])
      .filter(instant => instant > now)
      .reduce((soonest, instant) => Math.min(soonest, instant), Infinity);
    if (!Number.isFinite(next)) return;
    setTimeout(() => {
      if (Date.now() >= next) {
        const focusedProduct = grid.contains(document.activeElement)
          ? document.activeElement.dataset.product : null;
        renderProducts();
        if (focusedProduct) {
          const buttons = [...grid.querySelectorAll('button[data-product]')];
          (buttons.find(button => button.dataset.product === focusedProduct) || dealsOnly)
            .focus({ preventScroll: true });
        }
      }
      scheduleDealRefresh();
    }, Math.min(next - now, 2_147_483_647));
  }

  send.addEventListener('click', () => {
    const items = catalogue.products.filter(product => selected.has(product.id));
    if (!items.length) return;
    const lines = items.map(product => '- ' + product.name + (product.sku ? ' (' + product.sku + ')' : ''));
    const message = ['Hello Jeanrie, I would like to enquire about these Justine products:', ...lines,
      'Please confirm pricing and availability. Thank you!'].join('\n');
    window.open('https://wa.me/27822265134?text=' + encodeURIComponent(message), '_blank', 'noopener,noreferrer');
  });

  fetch('/data/catalogue.json').then(response => {
    if (!response.ok) throw new Error('Catalogue unavailable');
    return response.json();
  }).then(data => {
    catalogue = data;
    for (const name of [...new Set(data.products.map(product => product.category))].sort()) {
      category.add(new Option(name, name));
    }
    if (data.catalogues.length) {
      const links = byId('catalogue-links');
      links.replaceChildren();
      for (const edition of data.catalogues) {
        const item = element('li');
        const link = element('a', edition.title);
        link.href = edition.url;
        item.append(link);
        links.append(item);
      }
    }
    search.addEventListener('input', renderProducts);
    category.addEventListener('change', renderProducts);
    dealsOnly.addEventListener('change', renderProducts);
    renderBasket();
    renderProducts();
    if (data.pricingDisclaimer) status.insertAdjacentElement('afterend', element('p',data.pricingDisclaimer,'justine-price-disclaimer'));
    scheduleDealRefresh();
    if (location.hash.startsWith('#product-')) {
      const product = byId(location.hash.slice(1));
      (product || byId('shop')).scrollIntoView({ block: 'start' });
    }
  }).catch(() => {
    status.textContent = 'The online catalogue is unavailable. Use the Justine catalogue links below or ask Jeanrie on WhatsApp.';
  });
})();
