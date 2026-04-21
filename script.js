// ========== SISTEMA DE AUTENTICAÇÃO ==========
const SENHA_MASTER = 'nb7214';
const SESSION_KEY = 'danfe_auth';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

let notas = [];
let boletos = {};
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
    return (quantidade * precoUnitario).toFixed(2);
}

function formatarData(data) {
    if (!data) return '-';
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
        valorParcelaInput.value = `R$ ${valorParcela.toFixed(2)}`;
    } else {
        valorParcelaInput.value = 'R$ 0,00';
    }
}

// ========== FUNÇÕES PARA MÚLTIPLOS PRODUTOS ==========

// Calcular subtotal de um produto
function calcularSubtotal(produtoItem) {
    const quantidade = parseFloat(produtoItem.querySelector('.produto-quantidade').value) || 0;
    const preco = parseFloat(produtoItem.querySelector('.produto-preco').value) || 0;
    const subtotal = quantidade * preco;
    const subtotalInput = produtoItem.querySelector('.produto-subtotal');
    subtotalInput.value = `R$ ${subtotal.toFixed(2)}`;
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
    if (totalInput) totalInput.value = `R$ ${total.toFixed(2)}`;
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
                quantidade,
                unidade,
                precoUnitario,
                subtotal
            });
        }
    });
    return produtos;
}

// ========== FUNÇÃO ATUALIZADA PARA ADICIONAR PARCELAS COM FIREBASE ==========
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
    
    // Validações
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
    
    // Calcular valor da parcela
    const valorParcela = valorBoleto / numParcelas;
    
    try {
        for (let i = 0; i < numParcelas; i++) {
            const dataVenc = new Date(dataInicial);
            dataVenc.setMonth(dataVenc.getMonth() + i);
            
            const boleto = {
                notaId: notaId,
                valor: valorParcela,
                dataVencimento: dataVenc.toISOString().split('T')[0],
                pago: false,
                id: Date.now() + i,
                valorOriginal: valorBoleto,
                numParcelasTotal: numParcelas,
                parcelaNumero: i + 1,
                createdAt: new Date().toISOString()
            };
            
            await salvarBoletoFirebase(boleto);
        }
        
        // Recarregar dados
        if (typeof db !== 'undefined') {
            await carregarDadosFirebase();
        } else {
            saveData();
            renderBoletosAgrupados();
            renderNotas();
            atualizarSelectNotas();
        }
        
        // Limpar campos
        document.getElementById('valorBoleto').value = '';
        document.getElementById('numParcelas').value = '1';
        document.getElementById('parcelaData').value = '';
        document.getElementById('valorParcela').value = 'R$ 0,00';
        document.getElementById('selectNotaBoleto').value = '';
        
        mostrarNotificacao(`${numParcelas} parcela(s) de R$ ${valorParcela.toFixed(2)} adicionada(s) com sucesso!`, 'success');
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
    
    // Agrupar por mês/ano
    const notasPorMes = {};
    notasOrdenadas.forEach(nota => {
        const data = new Date(nota.dataNota);
        const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        if (!notasPorMes[mesAno]) notasPorMes[mesAno] = [];
        notasPorMes[mesAno].push(nota);
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
                                                ${p.quantidade} ${p.unidade} x R$ ${p.precoUnitario.toFixed(2)} = R$ ${p.subtotal.toFixed(2)}
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
        produtos: produtos,  // Array de produtos
        precoTotal: totalNota,
        createdAt: new Date().toISOString()
    };
    
    try {
        await salvarNotaFirebase(nota);
        
        if (typeof db !== 'undefined') {
            await carregarDadosFirebase();
        } else {
            notas.push(nota);
            if (!boletos[nota.id]) boletos[nota.id] = [];
            saveData();
            renderNotas();
            atualizarSelectNotas();
        }
        
        // Limpar formulário
        e.target.reset();
        // Limpar produtos (deixar apenas um vazio)
        const container = document.getElementById('produtosContainer');
        container.innerHTML = '';
        adicionarProduto(); // Adicionar um produto vazio
        
        document.getElementById('totalNota').value = 'R$ 0,00';
        mostrarNotificacao('Nota cadastrada com sucesso!', 'success');
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
    
    document.getElementById('boletosPageBtn')?.addEventListener('click', () => {
        document.getElementById('notasPage').style.display = 'none';
        document.getElementById('boletosPage').style.display = 'block';
        renderBoletosAgrupados();
    });

    const voltarNotasBtn = document.getElementById('voltarNotasBtn');
    if (voltarNotasBtn) {
        voltarNotasBtn.addEventListener('click', () => {
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'block';
        });
    }
    
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
                if (valorParcelaInput) valorParcelaInput.value = 'R$ 0,00';
                if (numParcelasInput) numParcelasInput.value = '1';
            }
        });
    }
    
    const valorBoletoInput = document.getElementById('valorBoleto');
    const numParcelasInput = document.getElementById('numParcelas');
    
    if (valorBoletoInput) {
        valorBoletoInput.addEventListener('input', calcularValorParcela);
    }
    
    if (numParcelasInput) {
        numParcelasInput.addEventListener('input', calcularValorParcela);
    }
    
    // ========== IMPLEMENTAÇÃO PARA MÚLTIPLOS PRODUTOS ==========
    
    // Inicializar produtos (configurar event listeners do primeiro produto)
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
    
    // Botão para adicionar novo produto
    const adicionarProdutoBtn = document.getElementById('adicionarProdutoBtn');
    if (adicionarProdutoBtn) {
        adicionarProdutoBtn.addEventListener('click', adicionarProduto);
    }
    
    // Inicializar produtos ao carregar a página
    inicializarProdutos();
    
    // Se houver produtos já existentes (edição), configurar todos
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
    
    // Chamar configuração de todos produtos
    configurarTodosProdutos();
    
    adicionarBotaoLogout();
    checkAuth();
});

window.onclick = (event) => {
    if (event.target === document.getElementById('editNotaModal')) fecharModal('editNotaModal');
    if (event.target === document.getElementById('editBoletoModal')) fecharModal('editBoletoModal');
};