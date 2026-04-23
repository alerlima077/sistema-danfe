// ========== SISTEMA DE AUTENTICAÇÃO ==========
const SENHA_MASTER = 'nb7214';
const SESSION_KEY = 'danfe_auth';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

let notas = [];
let boletos = {};
let pagamentos = [];
let syncInProgress = false;

// ========== FUNÇÕES DO FIREBASE ==========

// Carregar dados do Firebase
async function carregarDadosFirebase() {
    if (syncInProgress) return;
    syncInProgress = true;
    
    try {
        // Verificar se o Firebase está disponível
        if (typeof db === 'undefined') {
            console.log('Firebase não disponível, usando LocalStorage');
            loadData();
            syncInProgress = false;
            return;
        }
        
        // Carregar notas
        const notasSnapshot = await db.collection('notas').orderBy('dataNota', 'desc').get();
        notas = [];
        notasSnapshot.forEach(doc => {
            const notaData = doc.data();
            notas.push({ 
                id: doc.id, 
                ...notaData, 
                firebaseId: doc.id,
                // Manter compatibilidade com IDs antigos
                idOriginal: notaData.idOriginal || null
            });
        });
        
        // Carregar boletos
        const boletosSnapshot = await db.collection('boletos').get();
        boletos = {};
        boletosSnapshot.forEach(doc => {
            const data = doc.data();
            if (!boletos[data.notaId]) boletos[data.notaId] = [];
            boletos[data.notaId].push({ ...data, firebaseId: doc.id });
        });
        
        // Ordenar boletos por data
        for (let notaId in boletos) {
            boletos[notaId].sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
        }
        
        renderNotas();
        atualizarSelectNotas();
        renderBoletosAgrupados();
        
        console.log('Dados sincronizados com Firebase');
    } catch (error) {
        console.error('Erro ao carregar do Firebase:', error);
        mostrarNotificacao('Erro ao sincronizar dados! Usando modo offline.', 'warning');
        // Fallback para LocalStorage
        loadData();
    } finally {
        syncInProgress = false;
    }
}

// Salvar nota no Firebase
async function salvarNotaFirebase(nota) {
    try {
        if (typeof db === 'undefined') {
            // Fallback para LocalStorage
            notas.push(nota);
            saveData();
            return nota.id;
        }
        
        const notaSemId = { ...nota };
        delete notaSemId.firebaseId;
        delete notaSemId.id;
        // Guardar o ID original para compatibilidade
        notaSemId.idOriginal = nota.id;
        
        const docRef = await db.collection('notas').add(notaSemId);
        nota.firebaseId = docRef.id;
        return docRef.id;
    } catch (error) {
        console.error('Erro ao salvar nota:', error);
        throw error;
    }
}

// Atualizar nota no Firebase
async function atualizarNotaFirebase(notaId, dados) {
    try {
        if (typeof db === 'undefined') {
            // Fallback para LocalStorage
            const index = notas.findIndex(n => n.id == notaId || n.firebaseId == notaId);
            if (index !== -1) {
                notas[index] = { ...notas[index], ...dados };
                saveData();
            }
            return;
        }
        
        await db.collection('notas').doc(notaId).update(dados);
    } catch (error) {
        console.error('Erro ao atualizar nota:', error);
        throw error;
    }
}

// Excluir nota do Firebase
async function excluirNotaFirebase(notaId) {
    try {
        if (typeof db === 'undefined') {
            // Fallback para LocalStorage
            notas = notas.filter(n => n.id != notaId && n.firebaseId != notaId);
            delete boletos[notaId];
            saveData();
            return;
        }
        
        // Excluir a nota
        await db.collection('notas').doc(notaId).delete();
        
        // Excluir todos os boletos relacionados
        const boletosSnapshot = await db.collection('boletos').where('notaId', '==', notaId).get();
        const batch = db.batch();
        boletosSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error('Erro ao excluir nota:', error);
        throw error;
    }
}

// Salvar boleto no Firebase
async function salvarBoletoFirebase(boleto) {
    try {
        if (typeof db === 'undefined') {
            // Fallback para LocalStorage
            if (!boletos[boleto.notaId]) boletos[boleto.notaId] = [];
            boletos[boleto.notaId].push(boleto);
            saveData();
            return boleto.id;
        }
        
        const docRef = await db.collection('boletos').add(boleto);
        return docRef.id;
    } catch (error) {
        console.error('Erro ao salvar boleto:', error);
        throw error;
    }
}

// Atualizar boleto no Firebase
async function atualizarBoletoFirebase(boletoId, dados) {
    try {
        if (typeof db === 'undefined') {
            // Fallback para LocalStorage
            for (let notaId in boletos) {
                const index = boletos[notaId].findIndex(b => b.id == boletoId || b.firebaseId == boletoId);
                if (index !== -1) {
                    boletos[notaId][index] = { ...boletos[notaId][index], ...dados };
                    saveData();
                    break;
                }
            }
            return;
        }
        
        await db.collection('boletos').doc(boletoId).update(dados);
    } catch (error) {
        console.error('Erro ao atualizar boleto:', error);
        throw error;
    }
}

// Excluir boleto do Firebase
async function excluirBoletoFirebase(boletoId) {
    try {
        if (typeof db === 'undefined') {
            // Fallback para LocalStorage
            for (let notaId in boletos) {
                const index = boletos[notaId].findIndex(b => b.id == boletoId || b.firebaseId == boletoId);
                if (index !== -1) {
                    boletos[notaId].splice(index, 1);
                    if (boletos[notaId].length === 0) delete boletos[notaId];
                    saveData();
                    break;
                }
            }
            return;
        }
        
        await db.collection('boletos').doc(boletoId).delete();
    } catch (error) {
        console.error('Erro ao excluir boleto:', error);
        throw error;
    }
}

// Carregar pagamentos do Firebase
async function carregarPagamentosFirebase() {
    if (typeof db === 'undefined') return;
    
    try {
        const snapshot = await db.collection('pagamentos').orderBy('dataHora', 'desc').get();
        pagamentos = [];
        snapshot.forEach(doc => {
            pagamentos.push({ id: doc.id, ...doc.data() });
        });
        renderSangria();
        atualizarSelectMesesSangria();
    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
    }
}

// Salvar pagamento no Firebase
async function salvarPagamentoFirebase(pagamento) {
    if (typeof db !== 'undefined') {
        const docRef = await db.collection('pagamentos').add(pagamento);
        return docRef.id;
    } else {
        pagamentos.push(pagamento);
        return pagamento.id;
    }
}

// Excluir pagamento do Firebase
async function excluirPagamentoFirebase(pagamentoId) {
    if (typeof db !== 'undefined') {
        await db.collection('pagamentos').doc(pagamentoId).delete();
    } else {
        pagamentos = pagamentos.filter(p => p.id !== pagamentoId);
    }
}

// ========== FUNÇÕES DE RENDERIZAÇÃO DA SANGRIA ==========

function renderSangria() {
    const container = document.getElementById('sangriaAgrupada');
    if (!container) return;
    
    if (!verificarPermissao()) {
        container.innerHTML = '<div class="sem-boletos">Faça login para visualizar os pagamentos</div>';
        return;
    }
    
    // Filtrar por mês
    const mesFiltro = document.getElementById('selectMesSangria')?.value || 'todos';
    const categoriaFiltro = document.getElementById('selectCategoriaSangria')?.value || 'todos';
    
    let pagamentosFiltrados = [...pagamentos];
    
    if (mesFiltro !== 'todos') {
        pagamentosFiltrados = pagamentosFiltrados.filter(p => {
            const data = new Date(p.dataHora);
            const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
            return mesAno === mesFiltro;
        });
    }
    
    if (categoriaFiltro !== 'todos') {
        pagamentosFiltrados = pagamentosFiltrados.filter(p => p.categoria === categoriaFiltro);
    }
    
    if (pagamentosFiltrados.length === 0) {
        container.innerHTML = '<div class="sem-boletos">📭 Nenhum pagamento registrado</div>';
        document.getElementById('totalMesSangria').innerHTML = 'R$ 0,000';
        document.getElementById('mediaDiaSangria').innerHTML = 'R$ 0,000';
        document.getElementById('totalPagamentosMes').innerHTML = '0';
        return;
    }
    
    // Agrupar por dia
    const pagamentosPorDia = {};
    pagamentosFiltrados.forEach(pag => {
        const data = new Date(pag.dataHora);
        const diaStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        if (!pagamentosPorDia[diaStr]) pagamentosPorDia[diaStr] = [];
        pagamentosPorDia[diaStr].push(pag);
    });
    
    // Calcular totais (usando valorTotal se existir, senão usa valor)
    const totalMes = pagamentosFiltrados.reduce((sum, p) => sum + (p.valorTotal || p.valor), 0);
    const diasUnicos = Object.keys(pagamentosPorDia).length;
    const mediaDia = diasUnicos > 0 ? totalMes / diasUnicos : 0;
    
    document.getElementById('totalMesSangria').innerHTML = `R$ ${totalMes.toFixed(3)}`;
    document.getElementById('mediaDiaSangria').innerHTML = `R$ ${mediaDia.toFixed(3)}`;
    document.getElementById('totalPagamentosMes').innerHTML = pagamentosFiltrados.length;
    
    // Ordenar dias (mais recente primeiro)
    const diasOrdenados = Object.keys(pagamentosPorDia).sort().reverse();
    
    container.innerHTML = '';
    
    diasOrdenados.forEach(dia => {
        const pagamentosDia = pagamentosPorDia[dia];
        const totalDia = pagamentosDia.reduce((sum, p) => sum + (p.valorTotal || p.valor), 0);
        const dataFormatada = formatarDataCompleta(dia);
        
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'grupo-dia-sangria';
        grupoDiv.innerHTML = `
            <div class="header-dia-sangria" onclick="toggleGrupoDiaSangria(this)">
                <h4>📅 ${dataFormatada}</h4>
                <span class="total-dia">💰 R$ ${totalDia.toFixed(3)}</span>
            </div>
            <div class="conteudo-dia-sangria">
                <div class="table-responsive">
                    <table class="tabela-pagamentos">
                        <thead>
                            <tr>
                                <th>Hora</th>
                                <th>Estabelecimento</th>
                                <th>Itens</th>
                                <th>Categoria</th>
                                <th>Valor</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagamentosDia.map(pag => `
                                <tr>
                                    <td>${formatarHora(pag.dataHora)}</span></td>
                                    <td>
                                        <strong>${pag.estabelecimento || pag.descricao.split(' - ')[0]}</strong>
                                    </td>
                                    <td>
                                        <div title="${pag.itens ? pag.itens.map(i => `${i.descricao}: R$ ${i.valor.toFixed(3)}`).join('\n') : pag.descricao}">
                                            ${pag.itens ? pag.itens.map(i => i.descricao).join(', ') : pag.descricao}
                                            ${pag.itens && pag.itens.length > 1 ? `<br><small style="color: #666; cursor: help;">📋 ${pag.itens.length} itens</small>` : ''}
                                        </div>
                                    </td>
                                    <td><span class="badge-categoria categoria-${pag.categoria}">${getNomeCategoria(pag.categoria)}</span></span></td>
                                    <td>R$ ${(pag.valorTotal || pag.valor).toFixed(3)}</span></td>
                                    <td><button class="btn-delete-pagamento" onclick="excluirPagamento('${pag.id}')" title="Excluir">🗑️</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.appendChild(grupoDiv);
    });
}

// Alternar grupo de dia
window.toggleGrupoDiaSangria = function(element) {
    const conteudo = element.nextElementSibling;
    if (conteudo.style.display === 'none') {
        conteudo.style.display = 'block';
    } else {
        conteudo.style.display = 'none';
    }
};

// Formatar data completa
function formatarDataCompleta(dataStr) {
    const [ano, mes, dia] = dataStr.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${dia} de ${meses[parseInt(mes)-1]} de ${ano}`;
}

// Formatar hora
function formatarHora(dataHoraStr) {
    if (!dataHoraStr) return '-';
    const data = new Date(dataHoraStr);
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Obter nome da categoria
function getNomeCategoria(categoria) {
    const categorias = {
        material: '📦 Material',
        alimentacao: '🍽️ Alimentação',
        transporte: '🚗 Transporte',
        servicos: '🔧 Serviços',
        outros: '📌 Outros'
    };
    return categorias[categoria] || categoria;
}

// Atualizar select de meses da sangria
function atualizarSelectMesesSangria() {
    const select = document.getElementById('selectMesSangria');
    if (!select) return;
    
    const meses = new Set();
    pagamentos.forEach(pag => {
        const data = new Date(pag.dataHora);
        const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        meses.add(mesAno);
    });
    
    const mesesOrdenados = Array.from(meses).sort().reverse();
    
    const mesAtual = select.value;
    select.innerHTML = '<option value="todos">-- Todos os meses --</option>';
    mesesOrdenados.forEach(mes => {
        select.innerHTML += `<option value="${mes}">${formatarMesAno(mes)}</option>`;
    });
    if (mesAtual !== 'todos' && mesesOrdenados.includes(mesAtual)) select.value = mesAtual;
}

// Adicionar pagamento com múltiplos itens
async function adicionarPagamento() {
    if (!verificarPermissao()) return;
    
    const itens = coletarItensPagamento();
    const totalPagamento = calcularTotalPagamento();
    const estabelecimento = document.getElementById('estabelecimento').value;
    const categoria = document.getElementById('categoriaPagamento').value;
    const dataHora = document.getElementById('dataHoraPagamento').value;
    
    if (itens.length === 0) {
        alert('Adicione pelo menos um item!');
        return;
    }
    
    if (!estabelecimento) {
        alert('Preencha o campo Estabelecimento/Serviço!');
        return;
    }
    
    if (totalPagamento <= 0) {
        alert('O valor total deve ser maior que zero!');
        return;
    }
    
    if (!dataHora) {
        alert('Preencha a data e hora!');
        return;
    }
    
    // Criar descrição resumida para exibição na lista
    const descricaoResumida = `${estabelecimento} - ${itens.map(item => item.descricao).join(', ')}`;
    
    const pagamento = {
        id: Date.now(),
        itens: itens,
        estabelecimento: estabelecimento,
        descricao: descricaoResumida,
        valorTotal: totalPagamento,
        categoria: categoria,
        dataHora: dataHora,
        createdAt: new Date().toISOString()
    };
    
    try {
        await salvarPagamentoFirebase(pagamento);
        
        if (typeof db !== 'undefined') {
            await carregarPagamentosFirebase();
        } else {
            pagamentos.push(pagamento);
            renderSangria();
            atualizarSelectMesesSangria();
        }
        
        // Limpar formulário
        const container = document.getElementById('itensPagamentoContainer');
        container.innerHTML = '';
        adicionarItemPagamento(); // Adicionar um item vazio
        
        document.getElementById('estabelecimento').value = '';
        document.getElementById('categoriaPagamento').value = 'alimentacao';
        document.getElementById('dataHoraPagamento').value = '';
        document.getElementById('totalPagamento').value = 'R$ 0,000';
        
        mostrarNotificacao(`Pagamento de R$ ${totalPagamento.toFixed(3)} registrado com sucesso!`, 'success');
    } catch (error) {
        mostrarNotificacao('Erro ao registrar pagamento!', 'error');
    }
}

// Excluir pagamento
window.excluirPagamento = async function(pagamentoId) {
    if (!verificarPermissao()) return;
    
    if (confirm('Excluir este pagamento?')) {
        try {
            await excluirPagamentoFirebase(pagamentoId);
            
            if (typeof db !== 'undefined') {
                await carregarPagamentosFirebase();
            } else {
                pagamentos = pagamentos.filter(p => p.id != pagamentoId);
                renderSangria();
                atualizarSelectMesesSangria();
            }
            
            mostrarNotificacao('Pagamento excluído!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao excluir pagamento!', 'error');
        }
    }
};

// Configurar listener em tempo real
function configurarListenerRealtime() {
    if (typeof db === 'undefined') return;
    
    // Listener para notas
    db.collection('notas').onSnapshot((snapshot) => {
        if (!syncInProgress) {
            carregarDadosFirebase();
        }
    });
    
    // Listener para boletos
    db.collection('boletos').onSnapshot((snapshot) => {
        if (!syncInProgress) {
            carregarDadosFirebase();
        }
    });
}

// ========== FUNÇÕES DE AUTENTICAÇÃO ==========
function checkAuth() {
    const authData = localStorage.getItem(SESSION_KEY);
    
    if (authData) {
        try {
            const { timestamp, authenticated } = JSON.parse(authData);
            const now = new Date().getTime();
            
            if (authenticated && (now - timestamp) < SESSION_DURATION) {
                document.body.classList.remove('logged-out');
                document.body.classList.add('logged-in');
                return true;
            } else {
                logout();
                return false;
            }
        } catch(e) {
            logout();
            return false;
        }
    } else {
        document.body.classList.add('logged-out');
        document.body.classList.remove('logged-in');
        return false;
    }
}

function login(senha) {
    if (senha === SENHA_MASTER) {
        const authData = {
            authenticated: true,
            timestamp: new Date().getTime(),
            user: 'admin'
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(authData));
        document.body.classList.remove('logged-out');
        document.body.classList.add('logged-in');
        
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.style.display = 'none';
        
        // Usar Firebase se disponível
        if (typeof db !== 'undefined') {
            carregarDadosFirebase();
            carregarPagamentosFirebase();
            configurarListenerRealtime();
        } else {
            loadData();
        }
        
        mostrarNotificacao('Login realizado com sucesso!', 'success');
        return true;
    } else {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = '❌ Senha incorreta! Tente novamente.';
            errorDiv.style.display = 'block';
            setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
        }
        return false;
    }
}

function logout() {
    localStorage.removeItem(SESSION_KEY);
    document.body.classList.add('logged-out');
    document.body.classList.remove('logged-in');
    
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) loginOverlay.style.display = 'flex';
    
    const senhaInput = document.getElementById('senhaAcesso');
    if (senhaInput) senhaInput.value = '';
    
    mostrarNotificacao('Logout realizado com sucesso!', 'info');
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    let notificacao = document.getElementById('sistemaNotificacao');
    if (!notificacao) {
        notificacao = document.createElement('div');
        notificacao.id = 'sistemaNotificacao';
        notificacao.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10001;
            font-size: 14px;
            font-weight: 500;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;
        document.body.appendChild(notificacao);
        
        const style = document.createElement('style');
        style.textContent = `@keyframes slideInRight {
            from { opacity: 0; transform: translateX(100px); }
            to { opacity: 1; transform: translateX(0); }
        }`;
        document.head.appendChild(style);
    }
    
    const cores = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    notificacao.style.background = cores[tipo] || cores.info;
    notificacao.style.color = 'white';
    notificacao.textContent = mensagem;
    notificacao.style.display = 'block';
    setTimeout(() => { notificacao.style.display = 'none'; }, 3000);
}

function adicionarBotaoLogout() {
    const headerButtons = document.querySelector('.header-buttons');
    if (headerButtons && !document.getElementById('logoutBtn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logoutBtn';
        logoutBtn.className = 'btn-logout';
        logoutBtn.innerHTML = '🚪 Sair';
        logoutBtn.onclick = () => { if (confirm('Deseja realmente sair?')) logout(); };
        headerButtons.appendChild(logoutBtn);
    }
}

function verificarPermissao() {
    const authData = localStorage.getItem(SESSION_KEY);
    if (!authData) {
        mostrarNotificacao('Faça login para continuar!', 'warning');
        return false;
    }
    try {
        const { authenticated, timestamp } = JSON.parse(authData);
        if (!authenticated || (new Date().getTime() - timestamp) >= SESSION_DURATION) {
            logout();
            return false;
        }
        return true;
    } catch(e) { return false; }
}

// ========== FUNÇÕES PRINCIPAIS ==========
function loadData() {
    const storedNotas = localStorage.getItem('danfe_notas');
    const storedBoletos = localStorage.getItem('danfe_boletos');
    
    if (storedNotas) notas = JSON.parse(storedNotas);
    if (storedBoletos) boletos = JSON.parse(storedBoletos);
    
    renderNotas();
    atualizarSelectNotas();
    renderBoletosAgrupados();
}

function saveData() {
    localStorage.setItem('danfe_notas', JSON.stringify(notas));
    localStorage.setItem('danfe_boletos', JSON.stringify(boletos));
}

function calcularTotal(quantidade, precoUnitario) {
    return (quantidade * precoUnitario).toFixed(3);
}

function formatarData(data) {
    if (!data) return '-';
    // Se for string ISO, converter corretamente
    if (data.includes('T')) {
        const dataObj = new Date(data);
        const dia = String(dataObj.getDate()).padStart(2, '0');
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const ano = dataObj.getFullYear();
        return `${dia}/${mes}/${ano}`;
    }
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

// ========== CÁLCULO AUTOMÁTICO DO VALOR DA PARCELA ==========
function calcularValorParcela() {
    const valorBoleto = parseFloat(document.getElementById('valorBoleto').value);
    const numParcelas = parseInt(document.getElementById('numParcelas').value);
    const valorParcelaInput = document.getElementById('valorParcela');
    
    if (valorBoleto && numParcelas && numParcelas > 0) {
        const valorParcela = valorBoleto / numParcelas;
        valorParcelaInput.value = `R$ ${valorParcela.toFixed(3)}`;
    } else {
        valorParcelaInput.value = 'R$ 0,00';
    }
}

// ========== FUNÇÕES PARA INTERVALO PERSONALIZADO DE PARCELAS ==========

// Mostrar/esconder campo de dias personalizados
function toggleDiasPersonalizado() {
    const intervaloSelect = document.getElementById('intervaloParcelas');
    const diasPersonalizadoGroup = document.getElementById('diasPersonalizadoGroup');
    
    if (intervaloSelect && diasPersonalizadoGroup) {
        if (intervaloSelect.value === 'personalizado') {
            diasPersonalizadoGroup.style.display = 'block';
        } else {
            diasPersonalizadoGroup.style.display = 'none';
        }
    }
}

// Obter o número de dias entre parcelas
function getDiasIntervalo() {
    const intervaloSelect = document.getElementById('intervaloParcelas');
    if (!intervaloSelect) return 30;
    
    if (intervaloSelect.value === 'personalizado') {
        const diasPersonalizado = parseInt(document.getElementById('diasPersonalizado').value);
        return (diasPersonalizado && diasPersonalizado > 0) ? diasPersonalizado : 30;
    }
    
    return parseInt(intervaloSelect.value);
}

// ========== FUNÇÕES PARA MÚLTIPLOS PRODUTOS ==========

// Calcular subtotal de um produto
function calcularSubtotal(produtoItem) {
    const quantidade = parseFloat(produtoItem.querySelector('.produto-quantidade').value) || 0;
    const preco = parseFloat(produtoItem.querySelector('.produto-preco').value) || 0;
    const subtotal = quantidade * preco;
    const subtotalInput = produtoItem.querySelector('.produto-subtotal');
    subtotalInput.value = `R$ ${subtotal.toFixed(3)}`;
    return subtotal;
}

// Calcular total da nota
function calcularTotalNota() {
    let total = 0;
    document.querySelectorAll('.produto-item').forEach(produtoItem => {
        const quantidade = parseFloat(produtoItem.querySelector('.produto-quantidade').value) || 0;
        const preco = parseFloat(produtoItem.querySelector('.produto-preco').value) || 0;
        total += quantidade * preco;
    });
    const totalInput = document.getElementById('totalNota');
    if (totalInput) totalInput.value = `R$ ${total.toFixed(3)}`;
    return total;
}

// Adicionar novo produto
function adicionarProduto() {
    const container = document.getElementById('produtosContainer');
    const produtoCount = document.querySelectorAll('.produto-item').length + 1;
    
    const novoProduto = document.createElement('div');
    novoProduto.className = 'produto-item';
    novoProduto.innerHTML = `
        <div class="produto-header">
            <strong>Produto ${produtoCount}</strong>
            <button type="button" class="btn-remove-produto" onclick="removerProduto(this)">🗑️ Remover</button>
        </div>
        <div class="produto-fields">
            <div class="form-group">
                <label>Descrição</label>
                <input type="text" class="produto-descricao" placeholder="Descrição do produto" required>
            </div>
            <div class="form-group">
                <label>Quantidade</label>
                <input type="number" class="produto-quantidade" step="0.01" placeholder="Qtd" required>
            </div>
            <div class="form-group">
                <label>Unidade</label>
                <select class="produto-unidade">
                    <option value="UN">UN</option>
                    <option value="PC">PC</option>
                    <option value="KG">KG</option>
                    <option value="L">L</option>
                    <option value="M">M</option>
                    <option value="CX">CX</option>
                </select>
            </div>
            <div class="form-group">
                <label>Preço Unitário</label>
                <input type="number" class="produto-preco" step="0.01" placeholder="R$" required>
            </div>
            <div class="form-group">
                <label>Subtotal</label>
                <input type="text" class="produto-subtotal" readonly disabled placeholder="R$ 0,00">
            </div>
        </div>
    `;
    
    container.appendChild(novoProduto);
    
    // Adicionar event listeners para os novos campos
    const quantidadeInput = novoProduto.querySelector('.produto-quantidade');
    const precoInput = novoProduto.querySelector('.produto-preco');
    
    quantidadeInput.addEventListener('input', () => {
        calcularSubtotal(novoProduto);
        calcularTotalNota();
    });
    
    precoInput.addEventListener('input', () => {
        calcularSubtotal(novoProduto);
        calcularTotalNota();
    });
}

// Remover produto
function removerProduto(botao) {
    const produtoItem = botao.closest('.produto-item');
    if (document.querySelectorAll('.produto-item').length > 1) {
        produtoItem.remove();
        // Renumerar produtos
        document.querySelectorAll('.produto-item').forEach((item, index) => {
            item.querySelector('.produto-header strong').textContent = `Produto ${index + 1}`;
        });
        calcularTotalNota();
    } else {
        alert('A nota deve ter pelo menos um produto!');
    }
}

// Coletar dados dos produtos para salvar
function coletarProdutos() {
    const produtos = [];
    document.querySelectorAll('.produto-item').forEach(produtoItem => {
        const descricao = produtoItem.querySelector('.produto-descricao').value;
        const quantidade = parseFloat(produtoItem.querySelector('.produto-quantidade').value) || 0;
        const unidade = produtoItem.querySelector('.produto-unidade').value;
        const precoUnitario = parseFloat(produtoItem.querySelector('.produto-preco').value) || 0;
        const subtotal = quantidade * precoUnitario;
        
        if (descricao) {
            produtos.push({
                descricao,
                quantidade: parseFloat(quantidade.toFixed(3)),
                unidade,
                precoUnitario: parseFloat(precoUnitario.toFixed(3)),
                subtotal: parseFloat(subtotal.toFixed(3))
            });
        }
    });
    return produtos;
}

// ========== FUNÇÕES PARA MÚLTIPLOS ITENS NO PAGAMENTO ==========

// Calcular subtotal de um item do pagamento
function calcularSubtotalItemPagamento(itemPagamento) {
    const valor = parseFloat(itemPagamento.querySelector('.item-valor').value) || 0;
    return valor;
}

// Calcular total do pagamento
function calcularTotalPagamento() {
    let total = 0;
    document.querySelectorAll('.item-pagamento').forEach(item => {
        const valor = parseFloat(item.querySelector('.item-valor').value) || 0;
        total += valor;
    });
    const totalInput = document.getElementById('totalPagamento');
    if (totalInput) totalInput.value = `R$ ${total.toFixed(3)}`;
    return total;
}

// Adicionar novo item ao pagamento
function adicionarItemPagamento() {
    const container = document.getElementById('itensPagamentoContainer');
    
    // VERIFICAÇÃO: Se o container não existe, mostra erro e sai
    if (!container) {
        console.error('Container itensPagamentoContainer não encontrado!');
        alert('Erro: Não foi possível adicionar o item. Container não encontrado.');
        return;
    }
    
    const itemCount = document.querySelectorAll('.item-pagamento').length + 1;
    
    const novoItem = document.createElement('div');
    novoItem.className = 'item-pagamento';
    novoItem.innerHTML = `
        <div class="item-pagamento-header">
            <strong>Item ${itemCount}</strong>
            <button type="button" class="btn-remove-item-pagamento" onclick="removerItemPagamento(this)">🗑️ Remover</button>
        </div>
        <div class="item-pagamento-fields">
            <div class="form-group">
                <label>Descrição do Item</label>
                <input type="text" class="item-descricao" placeholder="Ex: Arroz, Feijão, Café" required>
            </div>
            <div class="form-group">
                <label>Valor</label>
                <input type="number" class="item-valor" step="0.001" placeholder="R$ 0,000" required>
            </div>
        </div>
    `;
    
    container.appendChild(novoItem);
    
    // Adicionar event listener para o novo item
    const valorInput = novoItem.querySelector('.item-valor');
    if (valorInput) {
        valorInput.addEventListener('input', () => {
            calcularTotalPagamento();
        });
    }
    
    // Recalcular total após adicionar
    calcularTotalPagamento();
}

// Remover item do pagamento
function removerItemPagamento(botao) {
    const itemPagamento = botao.closest('.item-pagamento');
    if (document.querySelectorAll('.item-pagamento').length > 1) {
        itemPagamento.remove();
        // Renumerar itens
        document.querySelectorAll('.item-pagamento').forEach((item, index) => {
            item.querySelector('.item-pagamento-header strong').textContent = `Item ${index + 1}`;
        });
        calcularTotalPagamento();
    } else {
        alert('O pagamento deve ter pelo menos um item!');
    }
}

// Coletar itens do pagamento
function coletarItensPagamento() {
    const itens = [];
    document.querySelectorAll('.item-pagamento').forEach(item => {
        const descricao = item.querySelector('.item-descricao').value;
        const valor = parseFloat(item.querySelector('.item-valor').value) || 0;
        
        if (descricao) {
            itens.push({
                descricao: descricao,
                valor: valor
            });
        }
    });
    return itens;
}

// ========== FUNÇÃO ATUALIZADA PARA ADICIONAR PARCELAS COM INTERVALO PERSONALIZADO ==========
async function adicionarParcelas() {
    if (!verificarPermissao()) return;
    
    const select = document.getElementById('selectNotaBoleto');
    const notaId = select.value;
    
    if (!notaId) {
        alert('Selecione uma nota fiscal primeiro!');
        return;
    }
    
    const valorBoleto = parseFloat(document.getElementById('valorBoleto').value);
    const numParcelas = parseInt(document.getElementById('numParcelas').value);
    const dataInicial = document.getElementById('parcelaData').value;
    const diasIntervalo = getDiasIntervalo();
    
    if (!valorBoleto || valorBoleto <= 0) {
        alert('Preencha o valor do boleto corretamente!');
        return;
    }
    
    if (!numParcelas || numParcelas < 1) {
        alert('Informe o número de parcelas!');
        return;
    }
    
    if (!dataInicial) {
        alert('Preencha a data do primeiro vencimento!');
        return;
    }
    
    // Calcular valor da parcela com 3 casas decimais
    const valorParcela = valorBoleto / numParcelas;
    
    let mensagemConfirmacao = `📊 Resumo das parcelas:\n\n`;
    mensagemConfirmacao += `💰 Valor total: R$ ${valorBoleto.toFixed(3)}\n`;
    mensagemConfirmacao += `📦 Número de parcelas: ${numParcelas}\n`;
    mensagemConfirmacao += `⏱️ Intervalo: ${diasIntervalo} dias\n`;
    mensagemConfirmacao += `💵 Valor por parcela: R$ ${valorParcela.toFixed(3)}\n\n`;
    mensagemConfirmacao += `📅 Datas de vencimento:\n`;
    
    for (let i = 0; i < numParcelas && i < 5; i++) {
        const dataVenc = new Date(dataInicial);
        dataVenc.setDate(dataVenc.getDate() + (diasIntervalo * i));
        mensagemConfirmacao += `  Parcela ${i+1}: ${formatarData(dataVenc.toISOString().split('T')[0])}\n`;
    }
    if (numParcelas > 5) {
        mensagemConfirmacao += `  ... e mais ${numParcelas - 5} parcela(s)\n`;
    }
    
    if (!confirm(mensagemConfirmacao + '\n\nConfirmar cadastro destas parcelas?')) {
        return;
    }
    
    try {
        for (let i = 0; i < numParcelas; i++) {
            const dataVenc = new Date(dataInicial);
            dataVenc.setDate(dataVenc.getDate() + (diasIntervalo * i));
            
            const boleto = {
                notaId: notaId,
                valor: parseFloat(valorParcela.toFixed(3)), // Salvar com 3 casas
                dataVencimento: dataVenc.toISOString().split('T')[0],
                pago: false,
                id: Date.now() + i,
                valorOriginal: parseFloat(valorBoleto.toFixed(3)),
                numParcelasTotal: numParcelas,
                parcelaNumero: i + 1,
                diasIntervalo: diasIntervalo,
                createdAt: new Date().toISOString()
            };
            
            await salvarBoletoFirebase(boleto);
        }
        
        if (typeof db !== 'undefined') {
            await carregarDadosFirebase();
        } else {
            saveData();
            renderBoletosAgrupados();
            renderNotas();
            atualizarSelectNotas();
        }
        
        document.getElementById('valorBoleto').value = '';
        document.getElementById('numParcelas').value = '1';
        document.getElementById('parcelaData').value = '';
        document.getElementById('valorParcela').value = 'R$ 0,000';
        document.getElementById('selectNotaBoleto').value = '';
        
        mostrarNotificacao(`${numParcelas} parcela(s) com intervalo de ${diasIntervalo} dias adicionada(s) com sucesso!`, 'success');
    } catch (error) {
        mostrarNotificacao('Erro ao adicionar parcelas!', 'error');
    }
}

function formatarMesAno(dataStr) {
    if (!dataStr) return '';
    const [ano, mes] = dataStr.split('-');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${meses[parseInt(mes)-1]} ${ano}`;
}

// ========== RENDERIZAR NOTAS AGRUPADAS POR MÊS ==========
function renderNotas() {
    const container = document.getElementById('notasAgrupadas');
    if (!container) return;
    
    if (!verificarPermissao()) {
        container.innerHTML = '<div class="sem-boletos">Faça login para visualizar as notas</div>';
        return;
    }
    
    if (notas.length === 0) {
        container.innerHTML = '<div class="sem-boletos">📭 Nenhuma nota fiscal cadastrada</div>';
        return;
    }
    
    // Ordenar notas por data (mais recente primeiro)
    const notasOrdenadas = [...notas].sort((a, b) => new Date(b.dataNota) - new Date(a.dataNota));
    
    // Agrupar por mês/ano - Usando split direto (sem new Date)
    const notasPorMes = {};
    notasOrdenadas.forEach(nota => {
        if (nota.dataNota) {
            const [ano, mes] = nota.dataNota.split('-');  // ⬅️ CORRETO!
            const mesAno = `${ano}-${mes}`;
            if (!notasPorMes[mesAno]) notasPorMes[mesAno] = [];
            notasPorMes[mesAno].push(nota);
        }
    });
        
    // Para cada mês, garantir que as notas estejam ordenadas por data (mais recente primeiro)
    for (let mes in notasPorMes) {
        notasPorMes[mes].sort((a, b) => new Date(b.dataNota) - new Date(a.dataNota));
    }
    
    // Ordenar meses (do mais recente para o mais antigo)
    const mesesOrdenados = Object.keys(notasPorMes).sort().reverse();
    
    // Preencher select de meses das notas
    const selectMesNotas = document.getElementById('selectMesNotas');
    if (selectMesNotas) {
        const mesAtual = selectMesNotas.value;
        selectMesNotas.innerHTML = '<option value="todos">-- Todos os meses --</option>';
        mesesOrdenados.forEach(mes => {
            selectMesNotas.innerHTML += `<option value="${mes}">${formatarMesAno(mes)}</option>`;
        });
        if (mesAtual !== 'todos' && mesesOrdenados.includes(mesAtual)) selectMesNotas.value = mesAtual;
    }
    
    // Filtrar por mês
    const mesFiltro = document.getElementById('selectMesNotas')?.value || 'todos';
    const mesesParaMostrar = mesFiltro === 'todos' ? mesesOrdenados : [mesFiltro];
    
    // Renderizar grupos
    container.innerHTML = '';
    
    mesesParaMostrar.forEach(mes => {
        let notasMes = notasPorMes[mes] || [];
        
        if (notasMes.length === 0) return;
        
        // Calcular total do mês
        const totalMes = notasMes.reduce((sum, nota) => sum + parseFloat(nota.precoTotal), 0);
        
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'grupo-mes-nota';
        grupoDiv.innerHTML = `
            <div class="header-mes-nota" onclick="toggleGrupoMesNota(this)">
                <h3>
                    📅 ${formatarMesAno(mes)}
                    <span class="badge-mes-nota">${notasMes.length} nota(s)</span>
                </h3>
                <span class="toggle-icon-nota">▼</span>
            </div>
            <div class="conteudo-mes-nota">
                <div class="table-responsive">
                    <table class="tabela-notas-mes">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>NFe</th>
                                <th>Fornecedor</th>
                                <th>Produto(s)</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${notasMes.map(nota => `
                                <tr>
                                    <td>${formatarData(nota.dataNota)}</td>
                                    <td><strong>${nota.nfeNumero}</strong></td>
                                    <td>
                                        <strong>${nota.fornecedor}</strong><br>
                                        <small>${nota.endereco || '-'}</small><br>
                                        <small>${nota.telefone || '-'}</small>
                                    </td>
                                    <td>
                                        ${nota.produtos ? nota.produtos.map(p => `
                                            <div style="border-bottom: 1px solid #eee; padding: 5px 0;">
                                                <strong>${p.descricao}</strong><br>
                                                ${p.quantidade} ${p.unidade} x R$ ${p.precoUnitario.toFixed(3)} = R$ ${p.subtotal.toFixed(3)}
                                            </div>
                                        `).join('') : `
                                            <div>
                                                <strong>${nota.descricao || '-'}</strong><br>
                                                ${nota.quantidade || '-'} ${nota.unidade || '-'} x R$ ${nota.precoUnitario ? nota.precoUnitario.toFixed(2) : '0,00'} = R$ ${nota.precoTotal || '0,00'}
                                            </div>
                                        `}
                                     </td>
                                    <td>
                                        <div class="action-buttons">
                                            <button class="btn-edit" onclick="editarNota('${nota.firebaseId || nota.id}')">✏️ Editar</button>
                                            <button class="btn-delete" onclick="excluirNota('${nota.firebaseId || nota.id}')">🗑️ Excluir</button>
                                            <button class="btn-boleto" onclick="verBoletosNota('${nota.firebaseId || nota.id}')">🎫 Boletos</button>
                                        </div>
                                     </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="resumo-mes-nota">
                    <span>💰 Total do Mês: <span class="total-notas">R$ ${totalMes.toFixed(2)}</span></span>
                    <span>📊 Média por Nota: R$ ${(totalMes / notasMes.length).toFixed(2)}</span>
                </div>
            </div>
        `;
        container.appendChild(grupoDiv);
    });
}

// Alternar expansão do grupo de notas
window.toggleGrupoMesNota = function(element) {
    element.classList.toggle('collapsed');
    const conteudo = element.nextElementSibling;
    conteudo.classList.toggle('collapsed');
};

// Cadastrar nota com múltiplos produtos
document.getElementById('notaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!verificarPermissao()) return;
    
    const produtos = coletarProdutos();
    
    if (produtos.length === 0) {
        alert('Adicione pelo menos um produto!');
        return;
    }
    
    const totalNota = calcularTotalNota();
    
    const nota = {
        id: Date.now(),
        dataNota: document.getElementById('dataNota').value,
        nfeNumero: document.getElementById('nfeNumero').value,
        fornecedor: document.getElementById('fornecedor').value,
        endereco: document.getElementById('endereco').value,
        telefone: document.getElementById('telefone').value,
        produtos: produtos.map(p => ({
            ...p,
            subtotal: parseFloat(p.subtotal.toFixed(3))
        })),
        precoTotal: parseFloat(totalNota.toFixed(3)),
        createdAt: new Date().toISOString()
    };
    
    try {
        let notaId;
        
        if (typeof db !== 'undefined') {
            const docRef = await db.collection('notas').add(nota);
            notaId = docRef.id;
            await carregarDadosFirebase();

            // ⭐ NOVO: Atualizar estoque para cada produto da nota ⭐
            for (const produtoNota of produtos) {
                await atualizarEstoquePorNota(produtoNota, notaId);
            }

        } else {
            notas.push(nota);
            if (!boletos[nota.id]) boletos[nota.id] = [];
            saveData();
            renderNotas();
            notaId = nota.id;
        }
        
        // ⭐ SALVAR O ID DA NOTA RECÉM-CADASTRADA PARA USAR NA PÁGINA DE BOLETOS ⭐
        sessionStorage.setItem('ultimaNotaCadastrada', notaId);
        
        // Limpar formulário
        e.target.reset();
        const container = document.getElementById('produtosContainer');
        container.innerHTML = '';
        adicionarProduto();
        
        document.getElementById('totalNota').value = 'R$ 0,000';
        mostrarNotificacao('Nota cadastrada com sucesso!', 'success');
        
        // ⭐ PERGUNTAR SE DESEJA IR PARA OS BOLETOS ⭐
        if (confirm('Nota cadastrada com sucesso! Deseja cadastrar os boletos agora?')) {
            irParaBoletosComNotaSelecionada(notaId);
        }
        
    } catch (error) {
        mostrarNotificacao('Erro ao cadastrar nota!', 'error');
    }
});

// Editar nota com Firebase
window.editarNota = async function(notaId) {
    if (!verificarPermissao()) return;
    
    // Buscar nota pelo firebaseId ou id
    const nota = notas.find(n => (n.firebaseId === notaId) || (n.id == notaId));
    if (!nota) return;
    
    const novoFornecedor = prompt('Novo fornecedor:', nota.fornecedor);
    const novoValor = prompt('Novo valor total:', nota.precoTotal);
    
    if (novoFornecedor && novoValor) {
        try {
            await atualizarNotaFirebase(nota.firebaseId || nota.id, {
                fornecedor: novoFornecedor,
                precoTotal: parseFloat(novoValor)
            });
            
            if (typeof db !== 'undefined') {
                await carregarDadosFirebase();
            } else {
                nota.fornecedor = novoFornecedor;
                nota.precoTotal = parseFloat(novoValor);
                saveData();
                renderNotas();
                atualizarSelectNotas();
            }
            
            mostrarNotificacao('Nota atualizada com sucesso!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao atualizar nota!', 'error');
        }
    }
};

// Excluir nota com Firebase
window.excluirNota = async function(notaId) {
    if (!verificarPermissao()) return;
    
    const nota = notas.find(n => (n.firebaseId === notaId) || (n.id == notaId));
    if (!nota) return;
    
    if (confirm(`Excluir nota ${nota?.nfeNumero}?`)) {
        try {
            await excluirNotaFirebase(nota.firebaseId || nota.id);
            
            if (typeof db !== 'undefined') {
                await carregarDadosFirebase();
            } else {
                notas = notas.filter(n => n.id != notaId && n.firebaseId != notaId);
                delete boletos[notaId];
                saveData();
                renderNotas();
                atualizarSelectNotas();
                renderBoletosAgrupados();
            }
            
            mostrarNotificacao('Nota excluída com sucesso!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao excluir nota!', 'error');
        }
    }
};

// Atualizar select
function atualizarSelectNotas() {
    const select = document.getElementById('selectNotaBoleto');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecione uma nota --</option>';
    notas.forEach(nota => {
        const idValue = nota.firebaseId || nota.id;
        select.innerHTML += `<option value="${idValue}">${nota.nfeNumero} - ${nota.fornecedor}</option>`;
    });
}
// ========== FUNÇÃO: RENDERIZAR BOLETOS AGRUPADOS POR MÊS ==========
function renderBoletosAgrupados() {
    const container = document.getElementById('boletosAgrupados');
    if (!container) return;
    
    if (!verificarPermissao()) {
        container.innerHTML = '<div class="sem-boletos">Faça login para visualizar os boletos</div>';
        return;
    }
    
    // Coletar todos os boletos de todas as notas
    let todosBoletos = [];
    notas.forEach(nota => {
        const notaId = nota.firebaseId || nota.id;
        const boletosNota = boletos[notaId] || [];
        boletosNota.forEach(boleto => {
            todosBoletos.push({
                ...boleto,
                notaId: notaId,
                fornecedor: nota.fornecedor,
                nfeNumero: nota.nfeNumero,
                valorTotalNota: nota.precoTotal
            });
        });
    });
    
    // Ordenar por data de vencimento (mais antigo primeiro)
    todosBoletos.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
    
    // Agrupar por mês/ano
    const boletosPorMes = {};
    todosBoletos.forEach(boleto => {
        const data = new Date(boleto.dataVencimento);
        const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        if (!boletosPorMes[mesAno]) boletosPorMes[mesAno] = [];
        boletosPorMes[mesAno].push(boleto);
    });
    
    // Ordenar meses
    const mesesOrdenados = Object.keys(boletosPorMes).sort();
    
    // Preencher select de meses
    const selectMes = document.getElementById('selectMes');
    if (selectMes) {
        const mesAtual = selectMes.value;
        selectMes.innerHTML = '<option value="todos">-- Todos os meses --</option>';
        mesesOrdenados.forEach(mes => {
            selectMes.innerHTML += `<option value="${mes}">${formatarMesAno(mes)}</option>`;
        });
        if (mesAtual !== 'todos' && mesesOrdenados.includes(mesAtual)) selectMes.value = mesAtual;
    }
    
    // Filtrar por mês e status
    const mesFiltro = document.getElementById('selectMes')?.value || 'todos';
    const statusFiltro = document.getElementById('selectStatus')?.value || 'todos';
    
    const mesesParaMostrar = mesFiltro === 'todos' ? mesesOrdenados : [mesFiltro];
    
    if (mesesParaMostrar.length === 0 || todosBoletos.length === 0) {
        container.innerHTML = '<div class="sem-boletos">📭 Nenhum boleto cadastrado</div>';
        return;
    }
    
    // Renderizar grupos
    container.innerHTML = '';
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    mesesParaMostrar.forEach(mes => {
        let boletosMes = boletosPorMes[mes] || [];
        
        // Filtrar por status
        if (statusFiltro !== 'todos') {
            boletosMes = boletosMes.filter(boleto => {
                const dataVenc = new Date(boleto.dataVencimento);
                const diasDiff = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
                
                if (statusFiltro === 'pago') return boleto.pago === true;
                if (statusFiltro === 'pendente') return !boleto.pago && diasDiff > 3;
                if (statusFiltro === 'vencido') return !boleto.pago && diasDiff < 0;
                if (statusFiltro === 'proximo') return !boleto.pago && diasDiff >= 0 && diasDiff <= 3;
                return true;
            });
        }
        
        if (boletosMes.length === 0) return;
        
        // Estatísticas do mês
        const totalPendente = boletosMes.filter(b => !b.pago && new Date(b.dataVencimento) >= hoje && (new Date(b.dataVencimento) - hoje) / (1000*60*60*24) > 3).reduce((s, b) => s + b.valor, 0);
        const totalProximo = boletosMes.filter(b => !b.pago && (new Date(b.dataVencimento) - hoje) / (1000*60*60*24) <= 3 && (new Date(b.dataVencimento) - hoje) / (1000*60*60*24) >= 0).reduce((s, b) => s + b.valor, 0);
        const totalVencido = boletosMes.filter(b => !b.pago && new Date(b.dataVencimento) < hoje).reduce((s, b) => s + b.valor, 0);
        const totalPago = boletosMes.filter(b => b.pago).reduce((s, b) => s + b.valor, 0);
        
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'grupo-mes';
        grupoDiv.innerHTML = `
            <div class="header-mes" onclick="toggleGrupoMes(this)">
                <h3>
                    📅 ${formatarMesAno(mes)}
                    <span class="badge-mes">${boletosMes.length} boletos</span>
                </h3>
                <span class="toggle-icon">▼</span>
            </div>
            <div class="conteudo-mes">
                <div class="table-responsive">
                    <table class="tabela-boletos-mes">
                        <thead>
                            <tr>
                                <th>Fornecedor</th>
                                <th>NFe</th>
                                <th>Valor</th>
                                <th>Vencimento</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${boletosMes.map((boleto, idx) => {
                                const dataVenc = new Date(boleto.dataVencimento);
                                const diasDiff = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
                                
                                let status = '', statusClass = '';
                                if (boleto.pago) {
                                    status = 'Pago ✅';
                                    statusClass = 'status-pago';
                                } else if (diasDiff < 0) {
                                    status = 'Vencido ❌';
                                    statusClass = 'status-vencido';
                                } else if (diasDiff <= 3) {
                                    status = 'Próximo Vencimento ⚠️';
                                    statusClass = 'status-proximo';
                                } else {
                                    status = 'Pendente 📅';
                                    statusClass = 'status-pendente';
                                }
                                
                                return `
                                    <tr>
                                        <td><strong>${boleto.fornecedor}</strong></td>
                                        <td>${boleto.nfeNumero}</td>
                                        <td>R$ ${boleto.valor.toFixed(2)}</td>
                                        <td>${formatarData(boleto.dataVencimento)}</td>
                                        <td><span class="status-badge ${statusClass}">${status}</span></td>
                                        <td>
                                            <div class="action-buttons">
                                                ${!boleto.pago ? `<button class="btn-edit" onclick="editarBoleto('${boleto.firebaseId}')">✏️ Editar</button>` : ''}
                                                ${!boleto.pago ? `<button class="btn-success" onclick="marcarBoletoPago('${boleto.firebaseId}')">💰 Pagar</button>` : '<span>✅ Pago</span>'}
                                                <button class="btn-delete" onclick="excluirBoleto('${boleto.firebaseId}')">🗑️ Excluir</button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="resumo-mes">
                    <span>💰 Total Pendente: <span class="total-pendente">R$ ${totalPendente.toFixed(2)}</span></span>
                    <span>⚠️ Próximo Vencimento: <span class="total-proximo">R$ ${totalProximo.toFixed(2)}</span></span>
                    <span>❌ Vencido: <span class="total-vencido">R$ ${totalVencido.toFixed(2)}</span></span>
                    <span>✅ Pago: <span class="total-pago">R$ ${totalPago.toFixed(2)}</span></span>
                </div>
            </div>
        `;
        container.appendChild(grupoDiv);
    });
}

// Alternar expansão do grupo
window.toggleGrupoMes = function(element) {
    element.classList.toggle('collapsed');
    const conteudo = element.nextElementSibling;
    conteudo.classList.toggle('collapsed');
};

// ========== FUNÇÕES DE EDIÇÃO DE BOLETOS COM FIREBASE ==========
window.editarBoleto = async function(boletoId) {
    if (!verificarPermissao()) return;
    
    // Buscar o boleto pelo firebaseId
    let boletoEncontrado = null;
    let notaIdEncontrada = null;
    
    for (let notaId in boletos) {
        const boleto = boletos[notaId].find(b => b.firebaseId === boletoId);
        if (boleto) {
            boletoEncontrado = boleto;
            notaIdEncontrada = notaId;
            break;
        }
    }
    
    if (!boletoEncontrado) return;
    
    const novoValor = prompt('Digite o novo valor:', boletoEncontrado.valor);
    const novaData = prompt('Digite a nova data (AAAA-MM-DD):', boletoEncontrado.dataVencimento);
    
    if (novoValor && !isNaN(novoValor)) {
        try {
            await atualizarBoletoFirebase(boletoId, { valor: parseFloat(novoValor) });
        } catch (error) {}
    }
    
    if (novaData) {
        try {
            await atualizarBoletoFirebase(boletoId, { dataVencimento: novaData });
        } catch (error) {}
    }
    
    if (typeof db !== 'undefined') {
        await carregarDadosFirebase();
    } else {
        if (novoValor && !isNaN(novoValor)) boletoEncontrado.valor = parseFloat(novoValor);
        if (novaData) boletoEncontrado.dataVencimento = novaData;
        saveData();
        renderBoletosAgrupados();
        renderNotas();
    }
    
    mostrarNotificacao('Boleto atualizado!', 'success');
};

window.excluirBoleto = async function(boletoId) {
    if (!verificarPermissao()) return;
    
    if (confirm('Excluir este boleto?')) {
        try {
            await excluirBoletoFirebase(boletoId);
            
            if (typeof db !== 'undefined') {
                await carregarDadosFirebase();
            } else {
                for (let notaId in boletos) {
                    const index = boletos[notaId].findIndex(b => b.firebaseId === boletoId);
                    if (index !== -1) {
                        boletos[notaId].splice(index, 1);
                        if (boletos[notaId].length === 0) delete boletos[notaId];
                        break;
                    }
                }
                saveData();
                renderBoletosAgrupados();
                renderNotas();
            }
            
            mostrarNotificacao('Boleto excluído!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao excluir boleto!', 'error');
        }
    }
};

window.marcarBoletoPago = async function(boletoId) {
    if (!verificarPermissao()) return;
    
    if (confirm('Marcar este boleto como pago?')) {
        try {
            await atualizarBoletoFirebase(boletoId, { pago: true });
            
            if (typeof db !== 'undefined') {
                await carregarDadosFirebase();
            } else {
                for (let notaId in boletos) {
                    const boleto = boletos[notaId].find(b => b.firebaseId === boletoId);
                    if (boleto) {
                        boleto.pago = true;
                        break;
                    }
                }
                saveData();
                renderBoletosAgrupados();
                renderNotas();
            }
            
            mostrarNotificacao('Boleto pago!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao marcar boleto como pago!', 'error');
        }
    }
};

// Ver boletos de uma nota
window.verBoletosNota = function(notaId) {
    document.getElementById('notasPage').style.display = 'none';
    document.getElementById('boletosPage').style.display = 'block';
    renderBoletosAgrupados();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Função para ir para página de boletos com a nota já selecionada
function irParaBoletosComNotaSelecionada(notaId) {
    // Mudar para página de boletos
    document.getElementById('notasPage').style.display = 'none';
    document.getElementById('boletosPage').style.display = 'block';
    document.getElementById('sangriaPage').style.display = 'none';
    
    // Aguardar um pequeno delay para garantir que o select foi populado
    setTimeout(() => {
        const selectNota = document.getElementById('selectNotaBoleto');
        if (selectNota) {
            selectNota.value = notaId;
            // Disparar o evento change para carregar o valor
            const event = new Event('change');
            selectNota.dispatchEvent(event);
            mostrarNotificacao(`Nota selecionada: ${selectNota.options[selectNota.selectedIndex]?.text}`, 'success');
        }
    }, 500);
}

// Fechar modal
window.fecharModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// Exportar Excel
document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
    let dadosExcel = [];
    dadosExcel.push(['SISTEMA DANFE - RELATÓRIO', '', '']);
    dadosExcel.push(['Data:', new Date().toLocaleDateString('pt-BR'), '']);
    dadosExcel.push(['', '', '']);
    dadosExcel.push(['NOTAS FISCAIS', '', '']);
    dadosExcel.push(['Data', 'NFe', 'Fornecedor', 'Produto', 'Quantidade', 'Valor Total']);
    
    notas.forEach(nota => {
        dadosExcel.push([
            formatarData(nota.dataNota), nota.nfeNumero, nota.fornecedor,
            `${nota.descricao} (${nota.unidade})`, nota.quantidade, `R$ ${nota.precoTotal}`
        ]);
    });
    
    dadosExcel.push(['', '', '', '', '', '']);
    dadosExcel.push(['BOLETOS POR MÊS', '', '', '', '', '']);
    
    const hoje = new Date();
    const todosBoletos = [];
    notas.forEach(nota => {
        const notaId = nota.firebaseId || nota.id;
        (boletos[notaId] || []).forEach(boleto => {
            const dataVenc = new Date(boleto.dataVencimento);
            const diasDiff = Math.ceil((dataVenc - hoje) / (1000*60*60*24));
            let status = boleto.pago ? 'Pago' : (diasDiff < 0 ? 'Vencido' : (diasDiff <= 3 ? 'Próximo Vencimento' : 'Pendente'));
            todosBoletos.push({
                mes: `${dataVenc.getFullYear()}-${String(dataVenc.getMonth()+1).padStart(2,'0')}`,
                fornecedor: nota.fornecedor,
                nfe: nota.nfeNumero,
                valor: boleto.valor,
                vencimento: formatarData(boleto.dataVencimento),
                status: status
            });
        });
    });
    
    todosBoletos.sort((a,b) => a.mes.localeCompare(b.mes));
    let mesAtual = '';
    todosBoletos.forEach(b => {
        if (b.mes !== mesAtual) {
            mesAtual = b.mes;
            dadosExcel.push([`📅 ${formatarMesAno(mesAtual)}`, '', '', '', '', '']);
            dadosExcel.push(['Fornecedor', 'NFe', 'Valor', 'Vencimento', 'Status', '']);
        }
        dadosExcel.push([b.fornecedor, b.nfe, `R$ ${b.valor.toFixed(2)}`, b.vencimento, b.status, '']);
    });
    
    const csv = dadosExcel.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `danfe_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    mostrarNotificacao('Relatório exportado!', 'success');
});

// ========== CARREGAR VALOR DA NOTA AUTOMATICAMENTE ==========
function carregarValorNota() {
    const select = document.getElementById('selectNotaBoleto');
    const notaId = select.value;
    const valorBoletoInput = document.getElementById('valorBoleto');
    
    if (notaId) {
        const nota = notas.find(n => (n.firebaseId === notaId) || (n.id == notaId));
        if (nota && nota.precoTotal) {
            valorBoletoInput.value = parseFloat(nota.precoTotal);
            calcularValorParcela();
            mostrarNotificacao(`Valor da nota R$ ${parseFloat(nota.precoTotal).toFixed(2)} carregado!`, 'info');
        }
    } else {
        valorBoletoInput.value = '';
        document.getElementById('valorParcela').value = 'R$ 0,00';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            login(document.getElementById('senhaAcesso').value);
        });
    }
    
    document.getElementById('adicionarParcelasBtn')?.addEventListener('click', adicionarParcelas);
    document.getElementById('selectMes')?.addEventListener('change', () => renderBoletosAgrupados());
    document.getElementById('selectStatus')?.addEventListener('change', () => renderBoletosAgrupados());
    document.getElementById('selectMesNotas')?.addEventListener('change', () => renderNotas());
    
    // ========== BOTÃO BOLETOS ==========
    document.getElementById('boletosPageBtn')?.addEventListener('click', () => {
        document.getElementById('dashboardPage').style.display = 'none';
        document.getElementById('notasPage').style.display = 'none';
        document.getElementById('boletosPage').style.display = 'block';
        document.getElementById('sangriaPage').style.display = 'none';
        document.getElementById('estoquePage').style.display = 'none';
        renderBoletosAgrupados();
        
        const ultimaNotaId = sessionStorage.getItem('ultimaNotaCadastrada');
        if (ultimaNotaId) {
            setTimeout(() => {
                const selectNota = document.getElementById('selectNotaBoleto');
                if (selectNota && selectNota.querySelector(`option[value="${ultimaNotaId}"]`)) {
                    selectNota.value = ultimaNotaId;
                    const event = new Event('change');
                    selectNota.dispatchEvent(event);
                    sessionStorage.removeItem('ultimaNotaCadastrada');
                    mostrarNotificacao(`Nota selecionada automaticamente!`, 'success');
                }
            }, 500);
        }
    });
    
    // Botão Dashboard
    const dashboardPageBtn = document.getElementById('dashboardPageBtn');
    if (dashboardPageBtn) {
        dashboardPageBtn.addEventListener('click', async () => {
            console.log('Dashboard clicado');
            document.getElementById('dashboardPage').style.display = 'block';
            document.getElementById('notasPage').style.display = 'none';
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('sangriaPage').style.display = 'none';
            document.getElementById('estoquePage').style.display = 'none';
            
            // ⭐ FORÇAR RECARREGAMENTO COMPLETO ⭐
            if (typeof carregarProdutos === 'function') {
                await carregarProdutos();
            }
            if (typeof carregarDashboard === 'function') {
                await carregarDashboard();
            }
        });
    }
    
    // ========== BOTÃO ESTOQUE ==========
    const estoquePageBtn = document.getElementById('estoquePageBtn');
    if (estoquePageBtn) {
        estoquePageBtn.addEventListener('click', () => {
            console.log('Estoque clicado');
            document.getElementById('dashboardPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'none';
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('sangriaPage').style.display = 'none';
            document.getElementById('estoquePage').style.display = 'block';
            if (typeof inicializarEstoque === 'function') {
                inicializarEstoque();
            }
        });
    }
    
    // ========== BOTÃO SANGRIA ==========
    const sangriaPageBtn = document.getElementById('sangriaPageBtn');
    if (sangriaPageBtn) {
        sangriaPageBtn.addEventListener('click', () => {
            console.log('Sangria clicado');
            document.getElementById('dashboardPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'none';
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('sangriaPage').style.display = 'block';
            document.getElementById('estoquePage').style.display = 'none';
            if (typeof renderSangria === 'function') {
                renderSangria();
            }
        });
    }
    
    // ========== BOTÃO NOTAS (se existir) ==========
    const notasPageBtn = document.getElementById('notasPageBtn');
    if (notasPageBtn) {
        notasPageBtn.addEventListener('click', () => {
            console.log('Notas clicado');
            document.getElementById('dashboardPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'block';
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('sangriaPage').style.display = 'none';
            document.getElementById('estoquePage').style.display = 'none';
        });
    }
    
    // ========== BOTÃO VOLTAR DA SANGRIA ==========
    const voltarDaSangriaBtn = document.getElementById('voltarDaSangriaBtn');
    if (voltarDaSangriaBtn) {
        voltarDaSangriaBtn.addEventListener('click', () => {
            document.getElementById('sangriaPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'block';
        });
    }
    
    // ========== BOTÃO ADICIONAR PAGAMENTO ==========
    const adicionarPagamentoBtn = document.getElementById('adicionarPagamentoBtn');
    if (adicionarPagamentoBtn) {
        adicionarPagamentoBtn.addEventListener('click', adicionarPagamento);
    }
    
    // ========== FILTROS SANGRIA ==========
    const selectMesSangria = document.getElementById('selectMesSangria');
    if (selectMesSangria) {
        selectMesSangria.addEventListener('change', () => renderSangria());
    }
    
    const selectCategoriaSangria = document.getElementById('selectCategoriaSangria');
    if (selectCategoriaSangria) {
        selectCategoriaSangria.addEventListener('change', () => renderSangria());
    }
    
    // ========== BOTÃO VOLTAR NOTAS ==========
    const voltarNotasBtn = document.getElementById('voltarNotasBtn');
    if (voltarNotasBtn) {
        voltarNotasBtn.addEventListener('click', () => {
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'block';
        });
    }
    
    // ========== SELECT NOTA BOLETO ==========
    const selectNota = document.getElementById('selectNotaBoleto');
    if (selectNota) {
        selectNota.addEventListener('change', (e) => {
            const notaId = e.target.value;
            if (notaId) {
                const formBoletos = document.getElementById('formBoletos');
                const listaBoletosContainer = document.getElementById('listaBoletosContainer');
                if (formBoletos) formBoletos.style.display = 'block';
                if (listaBoletosContainer) listaBoletosContainer.style.display = 'block';
                carregarValorNota();
            } else {
                const formBoletos = document.getElementById('formBoletos');
                const listaBoletosContainer = document.getElementById('listaBoletosContainer');
                if (formBoletos) formBoletos.style.display = 'none';
                if (listaBoletosContainer) listaBoletosContainer.style.display = 'none';
                
                const valorBoletoInput = document.getElementById('valorBoleto');
                const valorParcelaInput = document.getElementById('valorParcela');
                const numParcelasInput = document.getElementById('numParcelas');
                
                if (valorBoletoInput) valorBoletoInput.value = '';
                if (valorParcelaInput) valorParcelaInput.value = 'R$ 0,000';
                if (numParcelasInput) numParcelasInput.value = '1';
            }
        });
    }
    
    // ========== CÁLCULO VALOR PARCELA ==========
    const valorBoletoInput = document.getElementById('valorBoleto');
    const numParcelasInput = document.getElementById('numParcelas');
    
    if (valorBoletoInput) {
        valorBoletoInput.addEventListener('input', calcularValorParcela);
    }
    
    if (numParcelasInput) {
        numParcelasInput.addEventListener('input', calcularValorParcela);
    }
    
    // ========== IMPLEMENTAÇÃO PARA INTERVALO PERSONALIZADO DE PARCELAS ==========
    function toggleDiasPersonalizado() {
        const intervaloSelect = document.getElementById('intervaloParcelas');
        const diasPersonalizadoGroup = document.getElementById('diasPersonalizadoGroup');
        
        if (intervaloSelect && diasPersonalizadoGroup) {
            if (intervaloSelect.value === 'personalizado') {
                diasPersonalizadoGroup.style.display = 'block';
            } else {
                diasPersonalizadoGroup.style.display = 'none';
            }
        }
    }
    
    // Pré-definir data/hora atual no campo de pagamento
    const dataHoraPagamento = document.getElementById('dataHoraPagamento');
    if (dataHoraPagamento) {
        const agora = new Date();
        agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
        dataHoraPagamento.value = agora.toISOString().slice(0, 16);
    }
    
    const intervaloSelect = document.getElementById('intervaloParcelas');
    if (intervaloSelect) {
        intervaloSelect.addEventListener('change', toggleDiasPersonalizado);
    }
    
    const diasPersonalizado = document.getElementById('diasPersonalizado');
    if (diasPersonalizado) {
        diasPersonalizado.addEventListener('input', () => {
            if (diasPersonalizado.value) {
                const valorParcela = parseFloat(document.getElementById('valorBoleto').value);
                const numParcelas = parseInt(document.getElementById('numParcelas').value);
                if (valorParcela && numParcelas) {
                    calcularValorParcela();
                }
            }
        });
    }
    
    toggleDiasPersonalizado();
    
    // ========== IMPLEMENTAÇÃO PARA MÚLTIPLOS PRODUTOS ==========
    const adicionarProdutoBtn = document.getElementById('adicionarProdutoBtn');
    if (adicionarProdutoBtn) {
        adicionarProdutoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            adicionarProduto();
        });
    } else {
        console.log('Botão adicionarProdutoBtn não encontrado - verifique o ID no HTML');
    }
    
    function inicializarProdutos() {
        const primeiroProduto = document.querySelector('.produto-item');
        if (primeiroProduto) {
            const qtdInput = primeiroProduto.querySelector('.produto-quantidade');
            const precoInput = primeiroProduto.querySelector('.produto-preco');
            if (qtdInput) {
                qtdInput.addEventListener('input', () => {
                    calcularSubtotal(primeiroProduto);
                    calcularTotalNota();
                });
            }
            if (precoInput) {
                precoInput.addEventListener('input', () => {
                    calcularSubtotal(primeiroProduto);
                    calcularTotalNota();
                });
            }
        }
    }
    
    const adicionarItemPagamentoBtn = document.getElementById('adicionarItemPagamentoBtn');
    if (adicionarItemPagamentoBtn) {
        adicionarItemPagamentoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            adicionarItemPagamento();
        });
    } else {
        console.log('Botão adicionarItemPagamentoBtn não encontrado - verifique o ID no HTML');
    }
    
    inicializarProdutos();
    
    function configurarTodosProdutos() {
        document.querySelectorAll('.produto-item').forEach(produtoItem => {
            const qtdInput = produtoItem.querySelector('.produto-quantidade');
            const precoInput = produtoItem.querySelector('.produto-preco');
            if (qtdInput) {
                qtdInput.removeEventListener('input', () => calcularSubtotal(produtoItem));
                qtdInput.addEventListener('input', () => {
                    calcularSubtotal(produtoItem);
                    calcularTotalNota();
                });
            }
            if (precoInput) {
                precoInput.removeEventListener('input', () => calcularSubtotal(produtoItem));
                precoInput.addEventListener('input', () => {
                    calcularSubtotal(produtoItem);
                    calcularTotalNota();
                });
            }
        });
    }
    
    configurarTodosProdutos();
    
    // ========== CARREGAR DASHBOARD AO INICIAR ==========
    setTimeout(() => {
        if (typeof produtos !== 'undefined' && produtos.length > 0) {
            if (typeof carregarDashboard === 'function') {
                carregarDashboard();
            }
        } else {
            const checkInterval = setInterval(() => {
                if (typeof produtos !== 'undefined' && produtos.length > 0) {
                    clearInterval(checkInterval);
                    if (typeof carregarDashboard === 'function') {
                        carregarDashboard();
                    }
                }
            }, 500);
        }
    }, 1000);
    
    adicionarBotaoLogout();
    checkAuth();
});
window.onclick = (event) => {
    if (event.target === document.getElementById('editNotaModal')) fecharModal('editNotaModal');
    if (event.target === document.getElementById('editBoletoModal')) fecharModal('editBoletoModal');
};

// ========== FUNÇÕES DO DASHBOARD (ESTOQUE) ==========

let graficoConsumo = null;

// Carregar dados do Dashboard
async function carregarDashboard() {
    console.log('📊 Carregando Dashboard de Estoque...');
    
    // ⭐ FORÇAR RECARREGAMENTO DOS PRODUTOS DO FIREBASE ⭐
    if (typeof carregarProdutos === 'function') {
        await carregarProdutos();
    }
    
    if (typeof produtos === 'undefined' || produtos.length === 0) {
        console.log('Nenhum produto encontrado');
        document.getElementById('totalProdutos').innerText = '0';
        document.getElementById('produtosNormal').innerText = '0';
        document.getElementById('produtosAlerta').innerText = '0';
        document.getElementById('produtosCritico').innerText = '0';
        document.getElementById('valorTotalEstoque').innerHTML = 'R$ 0,00';
        document.getElementById('alertasEstoque').innerHTML = '<div class="empty-message">Nenhum produto cadastrado</div>';
        return;
    }
    
    // Calcular estatísticas do estoque
    let produtosNormal = 0;
    let produtosAlerta = 0;
    let produtosCritico = 0;
    let valorTotalEstoque = 0;
    
    produtos.forEach(produto => {
        const atual = produto.estoqueAtual || 0;
        const min = produto.estoqueMinimo || 0;
        const valor = atual * (produto.precoCusto || 0);
        valorTotalEstoque += valor;
        
        if (min > 0) {
            if (atual <= 0) {
                produtosCritico++;
            } else if (atual <= min) {
                produtosCritico++;
            } else if (atual <= min * 1.3) {
                produtosAlerta++;
            } else {
                produtosNormal++;
            }
        } else {
            produtosNormal++;
        }
    });
    
    // Atualizar cards
    document.getElementById('totalProdutos').innerText = produtos.length;
    document.getElementById('produtosNormal').innerText = produtosNormal;
    document.getElementById('produtosAlerta').innerText = produtosAlerta;
    document.getElementById('produtosCritico').innerText = produtosCritico;
    document.getElementById('valorTotalEstoque').innerHTML = `R$ ${valorTotalEstoque.toFixed(3)}`;
    
    // Giro de Estoque
    await atualizarGiroEstoque();
    
    // Alertas de Estoque
    atualizarAlertasEstoque();
    
    // Top Consumo
    await atualizarTopConsumo();
    
    // Gráfico de Consumo por Categoria
    await atualizarGraficoConsumo();
    
    // Resumo por Categoria
    atualizarResumoCategorias();
}

// Atualizar giro de estoque
async function atualizarGiroEstoque() {
    if (typeof db === 'undefined') {
        document.getElementById('giroEstoque').innerText = '0';
        return;
    }
    
    const hoje = new Date();
    const trintaDiasAtras = new Date(hoje);
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    
    const snapshot = await db.collection('movimentacoes').where('tipo', '==', 'saida').get();
    let totalMovimentado = 0;
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const dataMov = new Date(data.dataHora);
        if (dataMov >= trintaDiasAtras) {
            totalMovimentado += data.quantidade || 0;
        }
    });
    
    document.getElementById('giroEstoque').innerText = totalMovimentado.toFixed(0);
}

// Atualizar alertas de estoque
function atualizarAlertasEstoque() {
    const container = document.getElementById('alertasEstoque');
    
    if (typeof produtos === 'undefined' || produtos.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum produto cadastrado</div>';
        return;
    }
    
    const alertas = produtos.filter(p => {
        const min = p.estoqueMinimo || 0;
        const atual = p.estoqueAtual || 0;
        return min > 0 && atual <= min * 1.3;
    });
    
    if (alertas.length === 0) {
        container.innerHTML = '<div class="empty-message">✅ Todos os produtos com estoque adequado</div>';
        return;
    }
    
    // Ordenar por mais crítico
    alertas.sort((a, b) => (a.estoqueAtual || 0) - (b.estoqueAtual || 0));
    
    container.innerHTML = alertas.map(p => {
        const atual = p.estoqueAtual || 0;
        const min = p.estoqueMinimo || 0;
        const percentual = min > 0 ? (atual / min) * 100 : 100;
        
        let status = '';
        let statusClass = '';
        if (atual <= 0) {
            status = 'ZERADO!';
            statusClass = 'alerta-critico';
        } else if (atual <= min) {
            status = 'CRÍTICO';
            statusClass = 'alerta-critico';
        } else {
            status = 'ALERTA';
            statusClass = 'alerta-alerta';
        }
        
        return `
            <div class="alerta-item">
                <div>
                    <div class="alerta-produto">${p.nome}</div>
                    <div class="alerta-quantidade">Estoque: ${atual.toFixed(3)} ${p.unidade || 'UN'} | Mínimo: ${min.toFixed(3)}</div>
                </div>
                <span class="alerta-status ${statusClass}">${status}</span>
            </div>
        `;
    }).join('');
}

// Atualizar Top 5 Consumo
async function atualizarTopConsumo() {
    const container = document.getElementById('topConsumo');
    
    if (typeof db === 'undefined') {
        container.innerHTML = '<div class="empty-message">Firebase não disponível</div>';
        return;
    }
    
    try {
        const hoje = new Date();
        const trintaDiasAtras = new Date(hoje);
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        
        const snapshot = await db.collection('movimentacoes').where('tipo', '==', 'saida').get();
        const saidas = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataMov = new Date(data.dataHora);
            if (dataMov >= trintaDiasAtras) {
                saidas.push(data);
            }
        });
        
        if (saidas.length === 0) {
            container.innerHTML = '<div class="empty-message">Nenhum consumo nos últimos 30 dias</div>';
            return;
        }
        
        // Agrupar por produto
        const consumo = {};
        saidas.forEach(s => {
            const id = s.produtoId;
            if (!consumo[id]) {
                consumo[id] = {
                    nome: s.produtoNome || id,
                    quantidade: 0,
                    unidade: 'UN'
                };
            }
            consumo[id].quantidade += s.quantidade || 0;
        });
        
        // Adicionar unidade
        for (let id in consumo) {
            const produto = produtos.find(p => p.id === id);
            if (produto && produto.unidade) {
                consumo[id].unidade = produto.unidade;
            }
        }
        
        // Converter e ordenar
        let lista = Object.values(consumo);
        lista.sort((a, b) => b.quantidade - a.quantidade);
        lista = lista.slice(0, 5);
        
        const maxQtd = lista[0]?.quantidade || 1;
        
        container.innerHTML = lista.map(item => {
            const percent = (item.quantidade / maxQtd) * 100;
            return `
                <div class="consumo-item">
                    <div class="consumo-header">
                        <span class="consumo-nome">${item.nome}</span>
                        <span class="consumo-valor">${item.quantidade.toFixed(3)} ${item.unidade}</span>
                    </div>
                    <div class="consumo-bar">
                        <div class="consumo-bar-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar top consumo:', error);
        container.innerHTML = '<div class="empty-message">Erro ao carregar dados</div>';
    }
}

// Atualizar gráfico de consumo por categoria
async function atualizarGraficoConsumo() {
    const ctx = document.getElementById('graficoConsumo').getContext('2d');
    
    if (typeof db === 'undefined') return;
    
    try {
        const hoje = new Date();
        const trintaDiasAtras = new Date(hoje);
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        
        const snapshot = await db.collection('movimentacoes').where('tipo', '==', 'saida').get();
        const saidas = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataMov = new Date(data.dataHora);
            if (dataMov >= trintaDiasAtras) {
                saidas.push(data);
            }
        });
        
        // Agrupar por categoria
        const consumoPorCategoria = {};
        
        for (const saida of saidas) {
            const produto = produtos.find(p => p.id === saida.produtoId);
            const categoria = produto ? (produto.categoria || 'outros') : 'outros';
            const nomeCategoria = getNomeCategoria(categoria);
            
            if (!consumoPorCategoria[nomeCategoria]) {
                consumoPorCategoria[nomeCategoria] = 0;
            }
            consumoPorCategoria[nomeCategoria] += saida.quantidade || 0;
        }
        
        const categorias = Object.keys(consumoPorCategoria);
        const valores = Object.values(consumoPorCategoria);
        
        if (graficoConsumo) {
            graficoConsumo.destroy();
        }
        
        graficoConsumo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categorias,
                datasets: [{
                    label: 'Quantidade Consumida (unidades)',
                    data: valores,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.raw.toFixed(3)} unidades`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Quantidade Consumida'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Categorias'
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Erro ao carregar gráfico:', error);
    }
}

// Resumo por categoria
function atualizarResumoCategorias() {
    const container = document.getElementById('resumoCategorias');
    
    if (typeof produtos === 'undefined' || produtos.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum produto cadastrado</div>';
        return;
    }
    
    const categorias = {};
    produtos.forEach(produto => {
        const categoria = produto.categoria || 'outros';
        const nomeCategoria = getNomeCategoria(categoria);
        if (!categorias[nomeCategoria]) {
            categorias[nomeCategoria] = {
                quantidade: 0,
                valor: 0,
                produtos: 0
            };
        }
        categorias[nomeCategoria].quantidade += produto.estoqueAtual || 0;
        categorias[nomeCategoria].valor += (produto.estoqueAtual || 0) * (produto.precoCusto || 0);
        categorias[nomeCategoria].produtos++;
    });
    
    container.innerHTML = Object.entries(categorias).map(([nome, dados]) => `
        <div class="categoria-item">
            <div class="categoria-nome">${nome}</div>
            <div class="categoria-quantidade">${dados.quantidade.toFixed(0)} unidades</div>
            <div class="categoria-valor">R$ ${dados.valor.toFixed(3)}</div>
            <div class="categoria-valor" style="font-size: 11px;">${dados.produtos} produtos</div>
        </div>
    `).join('');
}

// Função auxiliar para nome da categoria
function getNomeCategoria(categoria) {
    const categorias = {
        'alimentacao': '🍽️ Alimentação',
        'bebidas': '🥤 Bebidas',
        'limpeza': '🧹 Limpeza',
        'higiene': '🚿 Higiene',
        'outros': '📌 Outros'
    };
    return categorias[categoria] || categoria;
}

// Atualizar gráfico de boletos
function atualizarGraficoBoletos(total, pagos, vencidos) {
    const ctx = document.getElementById('graficoBoletos').getContext('2d');
    const pendentes = total - pagos - vencidos;
    
    if (graficoBoletos) {
        graficoBoletos.destroy();
    }
    
    graficoBoletos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pagos', 'Pendentes', 'Vencidos'],
            datasets: [{
                data: [pagos, pendentes, vencidos],
                backgroundColor: ['#10b981', '#3b82f6', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Atualizar alertas de estoque
function atualizarAlertasEstoque() {
    const container = document.getElementById('alertasEstoque');
    
    if (typeof produtos === 'undefined' || produtos.length === 0) {
        container.innerHTML = '<div class="empty-message">Nenhum produto cadastrado</div>';
        return;
    }
    
    const alertas = produtos.filter(p => {
        const min = p.estoqueMinimo || 0;
        const atual = p.estoqueAtual || 0;
        return min > 0 && atual <= min;
    });
    
    if (alertas.length === 0) {
        container.innerHTML = '<div class="empty-message">✅ Todos os produtos com estoque adequado</div>';
        return;
    }
    
    // Ordenar por mais crítico
    alertas.sort((a, b) => (a.estoqueAtual || 0) - (b.estoqueAtual || 0));
    
    container.innerHTML = alertas.map(p => {
        const atual = p.estoqueAtual || 0;
        const min = p.estoqueMinimo || 0;
        const status = atual <= 0 ? 'ZERADO!' : 'CRÍTICO';
        const statusClass = atual <= 0 ? 'alerta-critico' : 'alerta-critico';
        
        return `
            <div class="alerta-item">
                <div>
                    <div class="alerta-produto">${p.nome}</div>
                    <div class="alerta-quantidade">Estoque: ${atual.toFixed(3)} ${p.unidade || 'UN'} / Mín: ${min.toFixed(3)}</div>
                </div>
                <span class="alerta-status ${statusClass}">${status}</span>
            </div>
        `;
    }).join('');
}

// Atualizar Top 5 Consumo
async function atualizarTopConsumo() {
    const container = document.getElementById('topConsumo');
    
    if (typeof db === 'undefined') {
        container.innerHTML = '<div class="empty-message">Firebase não disponível</div>';
        return;
    }
    
    try {
        // Buscar movimentações de saída dos últimos 30 dias
        const hoje = new Date();
        const trintaDiasAtras = new Date(hoje);
        trintaDiasAtras.setDate(hoje.getDate() - 30);
        
        const snapshot = await db.collection('movimentacoes')
            .where('tipo', '==', 'saida')
            .get();
        
        const saidas = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataMov = new Date(data.dataHora);
            if (dataMov >= trintaDiasAtras) {
                saidas.push(data);
            }
        });
        
        if (saidas.length === 0) {
            container.innerHTML = '<div class="empty-message">Nenhum consumo nos últimos 30 dias</div>';
            return;
        }
        
        // Agrupar por produto
        const consumo = {};
        saidas.forEach(s => {
            const id = s.produtoId;
            if (!consumo[id]) {
                consumo[id] = {
                    nome: s.produtoNome || id,
                    quantidade: 0
                };
            }
            consumo[id].quantidade += s.quantidade || 0;
        });
        
        // Converter e ordenar
        let lista = Object.values(consumo);
        lista.sort((a, b) => b.quantidade - a.quantidade);
        lista = lista.slice(0, 5);
        
        const maxQtd = lista[0]?.quantidade || 1;
        
        container.innerHTML = lista.map(item => {
            const percent = (item.quantidade / maxQtd) * 100;
            return `
                <div class="consumo-item">
                    <div class="consumo-header">
                        <span class="consumo-nome">${item.nome}</span>
                        <span class="consumo-valor">${item.quantidade.toFixed(3)} unidades</span>
                    </div>
                    <div class="consumo-bar">
                        <div class="consumo-bar-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar top consumo:', error);
        container.innerHTML = '<div class="empty-message">Erro ao carregar dados</div>';
    }
}

// Atualizar próximos vencimentos
function atualizarProximosVencimentos() {
    const container = document.getElementById('proximosVencimentos');
    
    let todosBoletos = [];
    for (let notaId in boletos) {
        const nota = notas.find(n => n.id == notaId || n.firebaseId == notaId);
        if (nota) {
            boletos[notaId].forEach(b => {
                if (!b.pago) {
                    todosBoletos.push({
                        ...b,
                        fornecedor: nota.fornecedor,
                        nfeNumero: nota.nfeNumero
                    });
                }
            });
        }
    }
    
    if (todosBoletos.length === 0) {
        container.innerHTML = '<div class="empty-message">✅ Nenhum boleto pendente</div>';
        return;
    }
    
    // Ordenar por data de vencimento
    todosBoletos.sort((a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));
    todosBoletos = todosBoletos.slice(0, 5);
    
    const hoje = new Date();
    
    container.innerHTML = todosBoletos.map(b => {
        const venc = new Date(b.dataVencimento);
        const diasDiff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
        
        let diasClass = '';
        let diasTexto = '';
        if (diasDiff < 0) {
            diasClass = 'dias-urgente';
            diasTexto = `Vencido há ${Math.abs(diasDiff)} dias`;
        } else if (diasDiff <= 3) {
            diasClass = 'dias-urgente';
            diasTexto = `Vence em ${diasDiff} dias`;
        } else if (diasDiff <= 7) {
            diasClass = 'dias-proximo';
            diasTexto = `Vence em ${diasDiff} dias`;
        } else {
            diasClass = 'dias-normal';
            diasTexto = `Vence em ${diasDiff} dias`;
        }
        
        return `
            <div class="vencimento-item">
                <div>
                    <div class="vencimento-fornecedor">${b.fornecedor}</div>
                    <div class="vencimento-valor">NFe: ${b.nfeNumero} | R$ ${b.valor.toFixed(3)}</div>
                </div>
                <span class="vencimento-dias ${diasClass}">${diasTexto}</span>
            </div>
        `;
    }).join('');
}

// Função para resetar e recarregar todos os dados do Dashboard
async function resetarDashboard() {
    console.log('🔄 Resetando Dashboard...');
    
    // Recarregar produtos do Firebase
    if (typeof carregarProdutos === 'function') {
        await carregarProdutos();
    }
    
    // Recarregar movimentações
    if (typeof carregarMovimentacoes === 'function') {
        await carregarMovimentacoes({});
    }
    
    // Recarregar Dashboard
    if (typeof carregarDashboard === 'function') {
        await carregarDashboard();
    }
    
    console.log('✅ Dashboard resetado com sucesso!');
}

// Expor função globalmente para teste no Console
window.resetarDashboard = resetarDashboard;


// Apenas a parte de correção para campos colados
function corrigirMaiusculasAoColar() {
    const campos = document.querySelectorAll('input[type="text"], input[type="tel"], textarea');
    
    campos.forEach(campo => {
        campo.addEventListener('paste', function(e) {
            setTimeout(() => {
                if (this.value !== this.value.toUpperCase()) {
                    this.value = this.value.toUpperCase();
                }
            }, 10);
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    corrigirMaiusculasAoColar();
});