// ---------------------------------------------------------------------------
// ReportGenerator (versão refatorada)
//
// Técnicas aplicadas (Fowler):
//  - Extract Method / Extract Function: cada seção (cabeçalho, corpo, rodapé)
//    virou uma unidade pequena com uma única responsabilidade.
//  - Replace Conditional with Polymorphism: os if/else por tipo de relatório
//    (CSV/HTML) e por perfil de usuário (ADMIN/USER) foram trocados por
//    objetos intercambiáveis (formatadores e políticas de acesso).
//  - Replace Magic Number with Symbolic Constant: 1000 e 500 ganharam nome.
//  - Introduce Null Object: tipo/perfil desconhecido não exige mais condicionais.
// ---------------------------------------------------------------------------

const ADMIN_PRIORITY_THRESHOLD = 1000; // acima disso, o item é prioritário para ADMIN
const USER_MAX_VISIBLE_VALUE = 500; // USER só enxerga itens com valor <= 500

const lines = (...rows) => rows.map((row) => `${row}\n`).join('');

// --- Formatadores: um por tipo de relatório ---------------------------------

const csvFormatter = {
  header: () => lines('ID,NOME,VALOR,USUARIO'),
  row: (item, user) => lines(`${item.id},${item.name},${item.value},${user.name}`),
  footer: (total) => `\nTotal,,\n${total},,\n`,
};

const htmlFormatter = {
  header: (user) =>
    lines(
      '<html><body>',
      '<h1>Relatório</h1>',
      `<h2>Usuário: ${user.name}</h2>`,
      '<table>',
      '<tr><th>ID</th><th>Nome</th><th>Valor</th></tr>',
    ),
  row: (item, user, highlighted) => {
    const style = highlighted ? ' style="font-weight:bold;"' : '';
    return lines(
      `<tr${style}><td>${item.id}</td><td>${item.name}</td><td>${item.value}</td></tr>`,
    );
  },
  footer: (total) => lines('</table>', `<h3>Total: ${total}</h3>`, '</body></html>'),
};

// Null Object: tipo de relatório desconhecido gera relatório vazio.
const nullFormatter = {
  header: () => '',
  row: () => '',
  footer: () => '',
};

const FORMATTERS = new Map([
  ['CSV', csvFormatter],
  ['HTML', htmlFormatter],
]);

// --- Políticas de acesso: uma por perfil de usuário -------------------------

const adminPolicy = {
  // Efeito colateral preservado do original: marca o item recebido.
  prepare: (item) => {
    if (item.value > ADMIN_PRIORITY_THRESHOLD) {
      item.priority = true;
    }
  },
  isVisible: () => true,
  isHighlighted: (item) => Boolean(item.priority),
};

const userPolicy = {
  prepare: () => {},
  isVisible: (item) => item.value <= USER_MAX_VISIBLE_VALUE,
  isHighlighted: () => false,
};

// Null Object: perfil desconhecido não enxerga nada.
const noAccessPolicy = {
  prepare: () => {},
  isVisible: () => false,
  isHighlighted: () => false,
};

const POLICIES = new Map([
  ['ADMIN', adminPolicy],
  ['USER', userPolicy],
]);

// --- Montagem do corpo ------------------------------------------------------

function renderBody(items, user, formatter, policy) {
  let body = '';
  let total = 0;

  for (const item of items) {
    policy.prepare(item);
    if (!policy.isVisible(item)) {
      continue;
    }
    body += formatter.row(item, user, policy.isHighlighted(item));
    total += item.value;
  }

  return { body, total };
}

// --- Classe pública (mesma API do original) ---------------------------------

export class ReportGenerator {
  constructor(database) {
    this.db = database;
  }

  /**
   * Gera um relatório de itens baseado no tipo e no usuário.
   * - Admins veem tudo.
   * - Users comuns só veem itens com valor <= 500.
   */
  generateReport(reportType, user, items) {
    const formatter = FORMATTERS.get(reportType) ?? nullFormatter;
    const policy = POLICIES.get(user?.role) ?? noAccessPolicy;

    const { body, total } = renderBody(items, user, formatter, policy);

    return (formatter.header(user) + body + formatter.footer(total)).trim();
  }
}
