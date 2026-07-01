import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';

/**
 * Job para publicar promoções agendadas
 * Executa periodicamente para verificar se há promoções que devem ser publicadas
 */
export const publishScheduledPromotions = async () => {
  try {
    console.log('🔄 [JOB] Verificando promoções agendadas para publicação...');
    
    const publishedCount = await Product.publishScheduledPromotions();
    
    if (publishedCount > 0) {
      console.log(`✅ [JOB] ${publishedCount} promoções foram publicadas automaticamente`);
    } else {
      console.log('ℹ️ [JOB] Nenhuma promoção agendada encontrada para publicação');
    }
    
    return publishedCount;
  } catch (error) {
    console.error('❌ [JOB] Erro ao publicar promoções agendadas:', error);
    throw error;
  }
};

/**
 * Job para expirar promoções
 * Executa periodicamente para verificar se há promoções que devem ser expiradas
 */
export const expirePromotions = async () => {
  try {
    console.log('🔄 [JOB] Verificando promoções para expiração...');
    
    const expiredCount = await Product.expirePromotions();
    
    if (expiredCount > 0) {
      console.log(`⏰ [JOB] ${expiredCount} promoções foram expiradas automaticamente`);
    } else {
      console.log('ℹ️ [JOB] Nenhuma promoção encontrada para expiração');
    }
    
    return expiredCount;
  } catch (error) {
    console.error('❌ [JOB] Erro ao expirar promoções:', error);
    throw error;
  }
};

/**
 * Job para expirar cupons
 * Executa periodicamente para verificar se há cupons que devem ser expirados
 */
export const expireCoupons = async () => {
  try {
    console.log('🔄 [JOB] Verificando cupons para expiração...');
    
    const expiredCount = await Coupon.expireCoupons();
    
    if (expiredCount > 0) {
      console.log(`⏰ [JOB] ${expiredCount} cupons foram expirados automaticamente`);
    } else {
      console.log('ℹ️ [JOB] Nenhum cupom encontrado para expiração');
    }
    
    return expiredCount;
  } catch (error) {
    console.error('❌ [JOB] Erro ao expirar cupons:', error);
    throw error;
  }
};

/**
 * Job completo que executa todas as operações
 * Usado pelo scheduler principal
 */
export const runPromotionAutomation = async () => {
  try {
    console.log('🚀 [AUTOMATION] Iniciando automação de promoções e cupons...');
    
    const [publishedCount, expiredPromotionsCount, expiredCouponsCount] = await Promise.all([
      publishScheduledPromotions(),
      expirePromotions(),
      expireCoupons()
    ]);
    
    const totalChanges = publishedCount + expiredPromotionsCount + expiredCouponsCount;
    
    if (totalChanges > 0) {
      console.log(`🎉 [AUTOMATION] Automação concluída: ${publishedCount} promoções publicadas, ${expiredPromotionsCount} promoções expiradas, ${expiredCouponsCount} cupons expirados`);
    } else {
      console.log('✅ [AUTOMATION] Automação concluída: nenhuma alteração necessária');
    }
    
    return { publishedCount, expiredPromotionsCount, expiredCouponsCount, totalChanges };
  } catch (error) {
    console.error('❌ [AUTOMATION] Erro na automação:', error);
    throw error;
  }
};

/**
 * Função para executar automação sob demanda
 * Útil para testes ou execução manual
 */
export const runManualAutomation = async () => {
  console.log('🔧 [MANUAL] Executando automação manual...');
  return await runPromotionAutomation();
};
