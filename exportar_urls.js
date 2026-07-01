import fs from 'fs';
import { query } from './src/config/database.js';

// Função para formatar a data como dd/mm/yyyy
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function exportCSV() {
  try {
    console.log('⚙️  Iniciando exportação das URLs de Produtos...');
    // Busca produtos com url atrelada e inclui o nome da Loja
    const produtos = await query(`
      SELECT 
        p.created_at, 
        p.title, 
        p.partner_url, 
        s.name as store_name
      FROM promotions p
      LEFT JOIN stores s ON p.store_id = s.id
      WHERE p.partner_url IS NOT NULL 
        AND p.partner_url != ''
      ORDER BY p.created_at DESC
    `);

    let produtosCSV = 'Data,Nome do Produto,URL,Loja\n';
    for (const p of produtos) {
      const data = formatDate(p.created_at);
      // Protege contra vírgulas que quebram o CSV
      const title = `"${(p.title || '').replace(/"/g, '""')}"`;
      const url = `"${(p.partner_url || '').replace(/"/g, '""')}"`;
      const store = `"${(p.store_name || '').replace(/"/g, '""')}"`;
      produtosCSV += `${data},${title},${url},${store}\n`;
    }
    fs.writeFileSync('/root/Geekloko/produtos_urls.csv', produtosCSV);
    console.log(`✅ Arquivo salvo: /root/Geekloko/produtos_urls.csv com ${produtos.length} produtos.`);

    console.log('\n⚙️  Iniciando exportação das URLs de Cupons...');
    // Busca cupons com redirect_url e inclui o nome da Loja
    const cupons = await query(`
      SELECT 
        c.created_at, 
        c.title, 
        c.redirect_url, 
        s.name as store_name
      FROM coupons c
      LEFT JOIN stores s ON c.store_id = s.id
      WHERE c.redirect_url IS NOT NULL 
        AND c.redirect_url != ''
      ORDER BY c.created_at DESC
    `);

    let cuponsCSV = 'Data,Nome do Cupom,URL,Loja\n';
    for (const c of cupons) {
      const data = formatDate(c.created_at);
      // Protege contra vírgulas que quebram o CSV
      const title = `"${(c.title || '').replace(/"/g, '""')}"`;
      const url = `"${(c.redirect_url || '').replace(/"/g, '""')}"`;
      const store = `"${(c.store_name || '').replace(/"/g, '""')}"`;
      cuponsCSV += `${data},${title},${url},${store}\n`;
    }
    fs.writeFileSync('/root/Geekloko/cupons_urls.csv', cuponsCSV);
    console.log(`✅ Arquivo salvo: /root/Geekloko/cupons_urls.csv com ${cupons.length} cupons.`);

    console.log('\n🎉 Exportação concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na exportação:', error);
    process.exit(1);
  }
}

exportCSV();
