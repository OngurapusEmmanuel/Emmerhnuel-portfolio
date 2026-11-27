'use strict';

/*
 * Builds the CV from index.html, so the portfolio is the only place to edit.
 * 1. readPortfolio() collects the content (anything marked "hidden" is skipped).
 * 2. renderPage() shows it on cv.html.
 * 3. buildPdf() writes the same content to a downloadable A4 PDF.
 * The demo sign-in details are deliberately not collected.
 */

const SOURCE = './index.html';
const PDF_NAME = 'Emmanuel_Ongurapus_CV.pdf';


/* 1. Read the portfolio */

function readPortfolio(page) {
  const clean = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
  const visible = (selector, root = page) =>
    [...root.querySelectorAll(selector)].filter((node) => !node.closest('[hidden]'));
  const text = (selector, root = page) => clean(visible(selector, root)[0]);
  const definition = (root, term) => {
    const dt = visible('dt', root).find((node) => clean(node) === term);
    return dt ? clean(dt.nextElementSibling) : '';
  };
  const portfolioUrl = page.querySelector('meta[property="og:url"]')?.content ?? '';

  const featured = visible('.feature').map((item) => {
    const url = item.querySelector('a.browser')?.getAttribute('href') ?? '';
    return {
      name: text('.feature-title', item),
      status: text('.status', item).startsWith('Live') ? 'Live' : text('.status', item),
      stack: definition(item, 'Built with').replace(/\.$/, ''),
      description: text('.feature-lead', item),
      url,
    };
  });

  const others = visible('.project').map((item) => ({
    name: text('h4', item),
    status: text('.status', item),
    stack: text('.stack', item),
    description: text('.project-body p', item),
    url: '',
  }));

  const experience = visible('.role').map((role) => ({
    title: text('h3', role),
    organisation: text('.role-org', role),
    dates: text('.role-dates', role),
    points: visible('.role-body li', role).map(clean),
    note: text('.role-note', role),
  }));

  // Education, certifications and community share one layout
  const records = visible('#education .columns > div').map((column) => ({
    heading: text('.column-title', column),
    items: visible('.record-list li', column).map((item) => ({
      title: text('h3', item),
      details: visible('p', item).map(clean),
    })),
  }));

  const links = ['GitHub', 'LinkedIn'].map((label) => {
    const dt = visible('.contact-list dt').find((node) => clean(node) === label);
    const url = dt?.nextElementSibling.querySelector('a')?.getAttribute('href') ?? '';
    return { label: `${label}: ${url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}`, url };
  }).filter((link) => link.url);

  const email = text('.contact-email a');

  return {
    name: text('.hero-name'),
    contact: [
      { label: definition(page.querySelector('.contact-list'), 'Location') },
      { label: text('a[href^="tel:"]'), url: page.querySelector('a[href^="tel:"]')?.getAttribute('href') },
      { label: email, url: `mailto:${email}` },
    ],
    links: [
      { label: `Portfolio: ${portfolioUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`, url: portfolioUrl },
      ...links,
    ],
    summary: visible('#about .prose p').map(clean),
    skills: visible('.skills > div').map((row) => ({ label: text('dt', row), value: text('dd', row) })),
    projects: [...featured, ...others],
    experience,
    records,
    referees: text('#contact .footnote'),
  };
}


/* 2. Show it on the page */

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function linkLine(items) {
  const list = element('ul', 'cv-contact');
  items.forEach((item) => {
    const entry = element('li');
    if (item.url) {
      const anchor = element('a', '', item.label);
      anchor.href = item.url;
      entry.append(anchor);
    } else {
      entry.textContent = item.label;
    }
    list.append(entry);
  });
  return list;
}

function renderPage(cv, sheet) {
  const section = (title) => {
    const block = element('section', 'cv-section');
    block.append(element('h2', '', title));
    sheet.append(block);
    return block;
  };
  const entry = (block, title, aside) => {
    const item = element('div', 'cv-entry');
    const head = element('div', 'cv-entry-head');
    head.append(element('h3', '', title));
    if (aside) head.append(element('span', 'cv-aside', aside));
    item.append(head);
    block.append(item);
    return item;
  };

  sheet.append(element('h1', '', cv.name), linkLine(cv.contact), linkLine(cv.links));

  const summary = section('Professional summary');
  cv.summary.forEach((paragraph) => summary.append(element('p', '', paragraph)));

  const skills = section('Technical skills');
  cv.skills.forEach((skill) => {
    const line = element('p');
    line.append(element('strong', '', `${skill.label}: `), skill.value);
    skills.append(line);
  });

  const projects = section('Projects');
  cv.projects.forEach((project) => {
    const item = entry(projects, project.name, project.status);
    if (project.stack) item.append(element('p', 'cv-meta', project.stack));
    item.append(element('p', '', project.description));
    if (project.url) item.append(linkLine([{ label: project.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), url: project.url }]));
  });

  const experience = section('Professional experience');
  cv.experience.forEach((role) => {
    const item = entry(experience, role.title, role.dates);
    item.append(element('p', 'cv-meta', role.organisation));
    const list = element('ul', 'cv-points');
    role.points.forEach((point) => list.append(element('li', '', point)));
    item.append(list);
    if (role.note) item.append(element('p', 'cv-note', role.note));
  });

  cv.records.forEach((record) => {
    const block = section(record.heading);
    record.items.forEach((record_) => {
      const item = entry(block, record_.title);
      record_.details.forEach((detail) => item.append(element('p', '', detail)));
    });
  });

  section('Referees').append(element('p', '', cv.referees));
}


/* 3. Write the PDF */

function buildPdf(cv) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  const colour = { ink: '#222222', navy: '#14295c', blue: '#1b3a9e', grey: '#5c6478' };
  let y = margin;

  const style = (size, weight, ink) => {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(ink);
  };

  // Start a new page if the next block would not fit
  const room = (height) => {
    if (y + height > bottom) {
      doc.addPage();
      y = margin;
    }
  };

  const paragraph = (content, { size = 9.5, weight = 'normal', ink = colour.ink, indent = 0, gap = 3 } = {}) => {
    style(size, weight, ink);
    const lineHeight = size * 1.38;
    doc.splitTextToSize(content, width - indent).forEach((line) => {
      room(lineHeight);
      doc.text(line, margin + indent, y, { baseline: 'top' });
      y += lineHeight;
    });
    y += gap;
  };

  // Contact details, centred and wrapped, each one clickable
  const centredLinks = (items) => {
    style(9, 'normal', colour.grey);
    const spacing = 16;
    const rows = [[]];
    let used = 0;
    items.forEach((item) => {
      const itemWidth = doc.getTextWidth(item.label);
      if (rows.at(-1).length && used + spacing + itemWidth > width) {
        rows.push([]);
        used = 0;
      }
      used += (rows.at(-1).length ? spacing : 0) + itemWidth;
      rows.at(-1).push({ ...item, itemWidth });
    });
    rows.forEach((row) => {
      const total = row.reduce((sum, item) => sum + item.itemWidth, 0) + spacing * (row.length - 1);
      let x = margin + (width - total) / 2;
      row.forEach((item) => {
        doc.setTextColor(item.url ? colour.blue : colour.grey);
        doc.text(item.label, x, y, { baseline: 'top' });
        if (item.url) doc.link(x, y, item.itemWidth, 11, { url: item.url });
        x += item.itemWidth + spacing;
      });
      y += 13;
    });
  };

  const heading = (title) => {
    room(70); // keep a heading together with the start of its section
    y += 9;
    style(11.5, 'bold', colour.navy);
    doc.text(title.toUpperCase(), margin, y, { baseline: 'top' });
    y += 17;
    doc.setDrawColor(colour.blue);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + width, y);
    y += 8;
  };

  // Title on the left, status or dates on the right
  const entryHead = (title, aside) => {
    room(48);
    style(8.5, 'italic', colour.grey);
    const asideWidth = aside ? doc.getTextWidth(aside) : 0;
    if (aside) doc.text(aside, margin + width, y + 1.5, { align: 'right', baseline: 'top' });
    style(10.5, 'bold', colour.navy);
    doc.splitTextToSize(title, width - asideWidth - 12).forEach((line) => {
      doc.text(line, margin, y, { baseline: 'top' });
      y += 14;
    });
  };

  style(23, 'bold', colour.navy);
  doc.text(cv.name.toUpperCase(), margin + width / 2, y, { align: 'center', baseline: 'top' });
  y += 31;
  centredLinks(cv.contact);
  centredLinks(cv.links);

  heading('Professional summary');
  cv.summary.forEach((item) => paragraph(item, { gap: 5 }));

  heading('Technical skills');
  cv.skills.forEach((skill) => {
    room(14);
    style(9.5, 'bold', colour.navy);
    const label = `${skill.label}: `;
    const labelWidth = doc.getTextWidth(label);
    doc.text(label, margin, y, { baseline: 'top' });
    paragraph(skill.value, { indent: labelWidth, gap: 2 });
  });

  heading('Projects');
  cv.projects.forEach((project) => {
    entryHead(project.name, project.status);
    if (project.stack) paragraph(project.stack, { size: 9, ink: colour.blue, gap: 1 });
    paragraph(project.description, { gap: project.url ? 1 : 7 });
    if (project.url) {
      room(20);
      style(9, 'normal', colour.blue);
      doc.textWithLink(project.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), margin, y + 9, { url: project.url });
      y += 20;
    }
  });

  heading('Professional experience');
  cv.experience.forEach((role) => {
    entryHead(role.title, role.dates);
    paragraph(role.organisation, { size: 9, ink: colour.blue });
    role.points.forEach((point) => {
      room(14);
      style(9.5, 'normal', colour.ink);
      doc.text('•', margin + 4, y, { baseline: 'top' });
      paragraph(point, { indent: 16, gap: 1 });
    });
    if (role.note) paragraph(role.note, { size: 8.5, weight: 'italic', ink: colour.grey });
    y += 6;
  });

  cv.records.forEach((record) => {
    heading(record.heading);
    record.items.forEach((item) => {
      room(30);
      style(9.5, 'bold', colour.navy);
      const label = `${item.title}: `;
      const labelWidth = doc.getTextWidth(label);
      // A single short detail sits on the same line as its title
      if (item.details.length === 1) {
        style(9.5, 'normal', colour.ink);
        if (labelWidth + doc.getTextWidth(item.details[0]) <= width) {
          style(9.5, 'bold', colour.navy);
          doc.text(label, margin, y, { baseline: 'top' });
          paragraph(item.details[0], { indent: labelWidth });
          return;
        }
      }
      paragraph(item.title, { weight: 'bold', ink: colour.navy, gap: 0 });
      item.details.forEach((detail) => paragraph(detail, { gap: 0 }));
      y += 5;
    });
  });

  heading('Referees');
  paragraph(cv.referees);

  doc.setProperties({ title: `${cv.name} CV`, author: cv.name });
  return doc;
}


/* Start */

async function start() {
  const status = document.querySelector('[data-cv-status]');
  const sheet = document.querySelector('[data-cv]');
  const button = document.querySelector('[data-download]');

  let cv;
  try {
    const response = await fetch(SOURCE, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');
    cv = readPortfolio(page);
    renderPage(cv, sheet);
  } catch (error) {
    console.error(error);
    status.textContent = location.protocol === 'file:'
      ? 'The CV can’t be built from a file opened directly. View the site through a web server, such as the deployed site or VS Code Live Server.'
      : 'The CV couldn’t be built. Reload the page to try again.';
    return;
  }

  status.hidden = true;
  sheet.hidden = false;

  if (!window.jspdf) {
    status.hidden = false;
    status.textContent = 'The download tool didn’t load. Reload the page to try again.';
    return;
  }

  button.disabled = false;
  button.addEventListener('click', () => buildPdf(cv).save(PDF_NAME));
}

start();
