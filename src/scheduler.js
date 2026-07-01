import cron from 'node-cron';
import { runPromotionAutomation } from './jobs/promotionJobs.js';
import Product from './models/Product.js';

/**
 * SISTEMA DE AUTOMAÇÃO DE PROMOÇÕES
 * 
 * Este scheduler executa automaticamente:
 * - Publicação de promoções agendadas
 * - Expiração de promoções que passaram do prazo
 * 
 * Configuração atual: executa a cada 5 minutos
 */

let isRunning = false;
let schedulerInstance = null;
let dynamicJobs = new Map(); // Armazenar jobs dinâmicos

/**
 * Inicializar o scheduler de automação
 */
export const startScheduler = () => {
  if (isRunning) {
    console.log('⚠️ [SCHEDULER] Scheduler já está rodando');
    return;
  }

  console.log('🚀 [SCHEDULER] Iniciando sistema de automação de promoções...');
  
  // Executar a cada 1 minuto para precisão máxima: */1 * * * *
  // Isso garante que as promoções sejam publicadas/expiradas no minuto exato
  schedulerInstance = cron.schedule('*/1 * * * *', async () => {
    try {
      console.log(`🕐 [SCHEDULER] Executando automação - ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
      
      await runPromotionAutomation();
      
    } catch (error) {
      console.error('❌ [SCHEDULER] Erro durante execução automática:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Sao_Paulo' // Fuso horário de Brasília
  });

  isRunning = true;
  console.log('✅ [SCHEDULER] Sistema de automação iniciado com sucesso');
  console.log('ℹ️ [SCHEDULER] Frequência: a cada 1 minuto (precisão máxima)');
  console.log('🌎 [SCHEDULER] Fuso horário: America/Sao_Paulo (Brasília)');
};

/**
 * Parar o scheduler
 */
export const stopScheduler = () => {
  if (!isRunning || !schedulerInstance) {
    console.log('⚠️ [SCHEDULER] Scheduler não está rodando');
    return;
  }

  schedulerInstance.stop();
  schedulerInstance = null;
  isRunning = false;
  
  console.log('🛑 [SCHEDULER] Sistema de automação parado');
};

/**
 * Reiniciar o scheduler
 */
export const restartScheduler = () => {
  console.log('🔄 [SCHEDULER] Reiniciando sistema de automação...');
  stopScheduler();
  setTimeout(() => {
    startScheduler();
  }, 1000);
};

/**
 * Obter status do scheduler
 */
export const getSchedulerStatus = () => {
  return {
    isRunning,
    nextExecution: isRunning ? 'Próxima execução em até 1 minuto' : 'Scheduler parado',
    timezone: 'America/Sao_Paulo',
    frequency: '*/1 * * * * (a cada 1 minuto - precisão máxima)'
  };
};

/**
 * Executar automação imediatamente (para testes)
 */
export const runNow = async () => {
  console.log('⚡ [SCHEDULER] Executando automação imediatamente...');
  try {
    const result = await runPromotionAutomation();
    console.log('✅ [SCHEDULER] Execução manual concluída com sucesso');
    return result;
  } catch (error) {
    console.error('❌ [SCHEDULER] Erro na execução manual:', error);
    throw error;
  }
};

/**
 * Criar job dinâmico para uma promoção específica
 */
export const schedulePromotionJob = (promotionId, dateTime, action) => {
  try {
    const targetDate = new Date(dateTime);
    const now = new Date();
    
    // Se a data já passou, executar imediatamente
    if (targetDate <= now) {
      console.log(`⚡ [DYNAMIC] Executando ${action} imediatamente para promoção ${promotionId}`);
      if (action === 'publish') {
        Product.publishScheduledPromotions();
      } else if (action === 'expire') {
        Product.expirePromotions();
      }
      return;
    }
    
    // Converter para formato cron (minuto hora dia mês *)
    const minute = targetDate.getMinutes();
    const hour = targetDate.getHours();
    const day = targetDate.getDate();
    const month = targetDate.getMonth() + 1;
    
    const cronExpression = `${minute} ${hour} ${day} ${month} *`;
    const jobKey = `${promotionId}-${action}`;
    
    console.log(`📅 [DYNAMIC] Agendando ${action} para promoção ${promotionId} em ${targetDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    console.log(`📅 [DYNAMIC] Cron: ${cronExpression}`);
    
    // Cancelar job existente se houver
    if (dynamicJobs.has(jobKey)) {
      dynamicJobs.get(jobKey).stop();
      dynamicJobs.delete(jobKey);
    }
    
    // Criar novo job
    const job = cron.schedule(cronExpression, async () => {
      try {
        console.log(`🎯 [DYNAMIC] Executando ${action} para promoção ${promotionId}`);
        
        if (action === 'publish') {
          await Product.publishScheduledPromotions();
        } else if (action === 'expire') {
          await Product.expirePromotions();
        }
        
        // Remover job após execução
        job.stop();
        dynamicJobs.delete(jobKey);
        console.log(`✅ [DYNAMIC] Job ${jobKey} concluído e removido`);
        
      } catch (error) {
        console.error(`❌ [DYNAMIC] Erro no job ${jobKey}:`, error);
      }
    }, {
      scheduled: true,
      timezone: 'America/Sao_Paulo'
    });
    
    dynamicJobs.set(jobKey, job);
    console.log(`✅ [DYNAMIC] Job ${jobKey} criado com sucesso`);
    
  } catch (error) {
    console.error(`❌ [DYNAMIC] Erro ao criar job para promoção ${promotionId}:`, error);
  }
};

/**
 * Cancelar job dinâmico de uma promoção
 */
export const cancelPromotionJob = (promotionId, action) => {
  const jobKey = `${promotionId}-${action}`;
  
  if (dynamicJobs.has(jobKey)) {
    dynamicJobs.get(jobKey).stop();
    dynamicJobs.delete(jobKey);
    console.log(`🛑 [DYNAMIC] Job ${jobKey} cancelado`);
  }
};

/**
 * Listar jobs dinâmicos ativos
 */
export const getActiveJobs = () => {
  return Array.from(dynamicJobs.keys());
};

// Iniciar automaticamente quando o módulo for importado
// (apenas em produção, em desenvolvimento você pode comentar esta linha)
if (process.env.NODE_ENV !== 'development') {
  startScheduler();
}

export default {
  start: startScheduler,
  stop: stopScheduler,
  restart: restartScheduler,
  status: getSchedulerStatus,
  runNow,
  schedulePromotionJob,
  cancelPromotionJob,
  getActiveJobs
};
