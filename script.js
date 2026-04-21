// ========== SISTEMA DE AUTENTICAÇÃO ==========
const SENHA_MASTER = 'nb7214';
const SESSION_KEY = 'danfe_auth';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

let notas = [];
let boletos = {};

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
        
        loadData();
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

// Event listeners para cálculo automático
document.getElementById('valorBoleto')?.addEventListener('input', calcularValorParcela);
document.getElementById('numParcelas')?.addEventListener('input', calcularValorParcela);

// ========== FUNÇÃO ATUALIZADA PARA ADICIONAR PARCELAS ==========
function adicionarParcelas() {
    if (!verificarPermissao()) return;
    
    const select = document.getElementById('selectNotaBoleto');
    const notaId = parseInt(select.value);
    
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
    
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;
    
    // Calcular valor da parcela
    const valorParcela = valorBoleto / numParcelas;
    
    if (!boletos[notaId]) boletos[notaId] = [];
    
    for (let i = 0; i < numParcelas; i++) {
        const dataVenc = new Date(dataInicial);
        dataVenc.setMonth(dataVenc.getMonth() + i);
        
        boletos[notaId].push({
            valor: valorParcela,
            dataVencimento: dataVenc.toISOString().split('T')[0],
            pago: false,
            id: Date.now() + i,
            valorOriginal: valorBoleto,
            numParcelasTotal: numParcelas,
            parcelaNumero: i + 1
        });
    }
    
    saveData();
    renderBoletosAgrupados();
    renderNotas();
    atualizarSelectNotas();
    
    // Limpar campos
    document.getElementById('valorBoleto').value = '';
    document.getElementById('numParcelas').value = '1';
    document.getElementById('parcelaData').value = '';
    document.getElementById('valorParcela').value = 'R$ 0,00';
    document.getElementById('selectNotaBoleto').value = '';
    
    mostrarNotificacao(`${numParcelas} parcela(s) de R$ ${valorParcela.toFixed(2)} adicionada(s) com sucesso!`, 'success');
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
                <table class="tabela-notas-mes">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>NFe</th>
                            <th>Fornecedor</th>
                            <th>Produto</th>
                            <th>Qtd</th>
                            <th>Preço Unit</th>
                            <th>Total</th>
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
                                <td>${nota.descricao}<br><small>${nota.unidade}</small></td>
                                <td>${nota.quantidade}</td>
                                <td>R$ ${nota.precoUnitario.toFixed(2)}</td>
                                <td><strong>R$ ${nota.precoTotal}</strong></td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="btn-edit" onclick="editarNota(${nota.id})">✏️ Editar</button>
                                        <button class="btn-delete" onclick="excluirNota(${nota.id})">🗑️ Excluir</button>
                                        <button class="btn-boleto" onclick="verBoletosNota(${nota.id})">🎫 Boletos</button>
                                    </div>
                                 </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
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

// Cadastrar nota
document.getElementById('notaForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!verificarPermissao()) return;
    
    const quantidade = parseFloat(document.getElementById('quantidade').value);
    const precoUnitario = parseFloat(document.getElementById('precoUnitario').value);
    
    const nota = {
        id: Date.now(),
        dataNota: document.getElementById('dataNota').value,
        nfeNumero: document.getElementById('nfeNumero').value,
        fornecedor: document.getElementById('fornecedor').value,
        endereco: document.getElementById('endereco').value,
        telefone: document.getElementById('telefone').value,
        descricao: document.getElementById('descricao').value,
        quantidade: quantidade,
        unidade: document.getElementById('unidade').value,
        precoUnitario: precoUnitario,
        precoTotal: calcularTotal(quantidade, precoUnitario)
    };
    
    notas.push(nota);
    if (!boletos[nota.id]) boletos[nota.id] = [];
    
    saveData();
    renderNotas();
    atualizarSelectNotas();
    e.target.reset();
    mostrarNotificacao('Nota cadastrada!', 'success');
});

// Editar nota
window.editarNota = function(notaId) {
    if (!verificarPermissao()) return;
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;
    
    const modal = document.getElementById('editNotaModal');
    const formContainer = document.getElementById('editNotaForm');
    
    formContainer.innerHTML = `
        <form id="formEditNota" class="modal-form">
            <div class="form-group"><label>Nº NFe</label><input type="text" id="edit_nfeNumero" value="${nota.nfeNumero}" required></div>
            <div class="form-group"><label>Data</label><input type="date" id="edit_dataNota" value="${nota.dataNota}" required></div>
            <div class="form-group"><label>Fornecedor</label><input type="text" id="edit_fornecedor" value="${nota.fornecedor}" required></div>
            <div class="form-group"><label>Endereço</label><input type="text" id="edit_endereco" value="${nota.endereco || ''}"></div>
            <div class="form-group"><label>Telefone</label><input type="text" id="edit_telefone" value="${nota.telefone || ''}"></div>
            <div class="form-group"><label>Produto</label><input type="text" id="edit_descricao" value="${nota.descricao}" required></div>
            <div class="form-group"><label>Quantidade</label><input type="number" id="edit_quantidade" step="0.01" value="${nota.quantidade}" required></div>
            <div class="form-group"><label>Unidade</label><select id="edit_unidade"><option value="UN">UN</option><option value="PC">PC</option><option value="KG">KG</option><option value="L">L</option><option value="M">M</option><option value="CX">CX</option></select></div>
            <div class="form-group"><label>Preço Unitário</label><input type="number" id="edit_precoUnitario" step="0.01" value="${nota.precoUnitario}" required></div>
            <div class="modal-buttons"><button type="submit" class="btn-save">Salvar</button><button type="button" class="btn-cancel" onclick="fecharModal('editNotaModal')">Cancelar</button></div>
        </form>
    `;
    
    document.getElementById('edit_unidade').value = nota.unidade;
    modal.style.display = 'flex';
    
    document.getElementById('formEditNota').addEventListener('submit', (e) => {
        e.preventDefault();
        const quantidade = parseFloat(document.getElementById('edit_quantidade').value);
        const precoUnitario = parseFloat(document.getElementById('edit_precoUnitario').value);
        
        nota.nfeNumero = document.getElementById('edit_nfeNumero').value;
        nota.dataNota = document.getElementById('edit_dataNota').value;
        nota.fornecedor = document.getElementById('edit_fornecedor').value;
        nota.endereco = document.getElementById('edit_endereco').value;
        nota.telefone = document.getElementById('edit_telefone').value;
        nota.descricao = document.getElementById('edit_descricao').value;
        nota.quantidade = quantidade;
        nota.unidade = document.getElementById('edit_unidade').value;
        nota.precoUnitario = precoUnitario;
        nota.precoTotal = calcularTotal(quantidade, precoUnitario);
        
        saveData();
        renderNotas();
        atualizarSelectNotas();
        fecharModal('editNotaModal');
        mostrarNotificacao('Nota atualizada!', 'success');
    });
};

// Excluir nota
window.excluirNota = function(notaId) {
    if (!verificarPermissao()) return;
    const nota = notas.find(n => n.id === notaId);
    if (confirm(`Excluir nota ${nota?.nfeNumero}?`)) {
        notas = notas.filter(n => n.id !== notaId);
        delete boletos[notaId];
        saveData();
        renderNotas();
        atualizarSelectNotas();
        renderBoletosAgrupados();
        mostrarNotificacao('Nota excluída!', 'success');
    }
};

// Atualizar select
function atualizarSelectNotas() {
    const select = document.getElementById('selectNotaBoleto');
    if (!select) return;
    select.innerHTML = '<option value="">-- Selecione uma nota --</option>';
    notas.forEach(nota => {
        select.innerHTML += `<option value="${nota.id}">${nota.nfeNumero} - ${nota.fornecedor}</option>`;
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
        const boletosNota = boletos[nota.id] || [];
        boletosNota.forEach(boleto => {
            todosBoletos.push({
                ...boleto,
                notaId: nota.id,
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
                <table class="tabela-boletos-mes">
                    <thead>
                        <tr><th>Fornecedor</th><th>NFe</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr>
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
                            
                            const boletosNota = boletos[boleto.notaId] || [];
                            const indexReal = boletosNota.findIndex(b => b.id === boleto.id);
                            
                            return `
                                <tr>
                                    <td><strong>${boleto.fornecedor}</strong></td>
                                    <td>${boleto.nfeNumero}</td>
                                    <td>R$ ${boleto.valor.toFixed(2)}</td>
                                    <td>${formatarData(boleto.dataVencimento)}</td>
                                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                                    <td>
                                        <div class="action-buttons">
                                            ${!boleto.pago ? `<button class="btn-edit" onclick="editarBoleto(${boleto.notaId}, ${indexReal})">✏️ Editar</button>` : ''}
                                            ${!boleto.pago ? `<button class="btn-success" onclick="marcarBoletoPago(${boleto.notaId}, ${indexReal})">💰 Pagar</button>` : '<span>✅ Pago</span>'}
                                            <button class="btn-delete" onclick="excluirBoleto(${boleto.notaId}, ${indexReal})">🗑️ Excluir</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
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

// ========== FUNÇÕES DE EDIÇÃO DE BOLETOS ==========
window.editarBoleto = function(notaId, boletoIndex) {
    if (!verificarPermissao()) return;
    const boleto = boletos[notaId]?.[boletoIndex];
    if (!boleto) return;
    
    const novoValor = prompt('Digite o novo valor:', boleto.valor);
    const novaData = prompt('Digite a nova data (AAAA-MM-DD):', boleto.dataVencimento);
    
    if (novoValor && !isNaN(novoValor)) boleto.valor = parseFloat(novoValor);
    if (novaData) boleto.dataVencimento = novaData;
    
    saveData();
    renderBoletosAgrupados();
    renderNotas();
    mostrarNotificacao('Boleto atualizado!', 'success');
};

window.excluirBoleto = function(notaId, boletoIndex) {
    if (!verificarPermissao()) return;
    if (confirm('Excluir este boleto?')) {
        boletos[notaId].splice(boletoIndex, 1);
        if (boletos[notaId].length === 0) delete boletos[notaId];
        saveData();
        renderBoletosAgrupados();
        renderNotas();
        mostrarNotificacao('Boleto excluído!', 'success');
    }
};

window.marcarBoletoPago = function(notaId, boletoIndex) {
    if (!verificarPermissao()) return;
    if (confirm('Marcar este boleto como pago?')) {
        boletos[notaId][boletoIndex].pago = true;
        saveData();
        renderBoletosAgrupados();
        renderNotas();
        mostrarNotificacao('Boleto pago!', 'success');
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
        (boletos[nota.id] || []).forEach(boleto => {
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
    const notaId = parseInt(select.value);
    const valorBoletoInput = document.getElementById('valorBoleto');
    
    if (notaId) {
        const nota = notas.find(n => n.id === notaId);
        if (nota && nota.precoTotal) {
            // Carregar o valor total da nota no campo Valor do Boleto
            valorBoletoInput.value = parseFloat(nota.precoTotal);
            // Disparar o cálculo automático da parcela
            calcularValorParcela();
            mostrarNotificacao(`Valor da nota R$ ${parseFloat(nota.precoTotal).toFixed(2)} carregado!`, 'info');
        }
    } else {
        // Limpar o campo se nenhuma nota for selecionada
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
        // Filtro de mês para notas
    document.getElementById('selectMesNotas')?.addEventListener('change', () => renderNotas());
    
    document.getElementById('boletosPageBtn')?.addEventListener('click', () => {
        document.getElementById('notasPage').style.display = 'none';
        document.getElementById('boletosPage').style.display = 'block';
        renderBoletosAgrupados();
    });

    // Botão para voltar para página de notas
    const voltarNotasBtn = document.getElementById('voltarNotasBtn');
    if (voltarNotasBtn) {
        voltarNotasBtn.addEventListener('click', () => {
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'block';
        });
    }
    
    // ⭐ NOVO: Configurar select de notas com carregamento automático do valor
    const selectNota = document.getElementById('selectNotaBoleto');
    if (selectNota) {
        selectNota.addEventListener('change', (e) => {
            const notaId = parseInt(e.target.value);
            if (notaId) {
                // Mostrar os containers de boletos
                const formBoletos = document.getElementById('formBoletos');
                const listaBoletosContainer = document.getElementById('listaBoletosContainer');
                if (formBoletos) formBoletos.style.display = 'block';
                if (listaBoletosContainer) listaBoletosContainer.style.display = 'block';
                
                // Renderizar boletos da nota selecionada
                if (typeof renderizarBoletosPage === 'function') {
                    renderizarBoletosPage(notaId);
                }
                
                // ⭐ Carregar o valor da nota automaticamente
                carregarValorNota();
            } else {
                // Esconder containers quando nenhuma nota for selecionada
                const formBoletos = document.getElementById('formBoletos');
                const listaBoletosContainer = document.getElementById('listaBoletosContainer');
                if (formBoletos) formBoletos.style.display = 'none';
                if (listaBoletosContainer) listaBoletosContainer.style.display = 'none';
                
                // Limpar campos
                const valorBoletoInput = document.getElementById('valorBoleto');
                const valorParcelaInput = document.getElementById('valorParcela');
                const numParcelasInput = document.getElementById('numParcelas');
                
                if (valorBoletoInput) valorBoletoInput.value = '';
                if (valorParcelaInput) valorParcelaInput.value = 'R$ 0,00';
                if (numParcelasInput) numParcelasInput.value = '1';
            }
        });
    }
    
    // ⭐ NOVO: Event listeners para cálculo automático do valor da parcela
    const valorBoletoInput = document.getElementById('valorBoleto');
    const numParcelasInput = document.getElementById('numParcelas');
    
    if (valorBoletoInput) {
        valorBoletoInput.addEventListener('input', calcularValorParcela);
    }
    
    if (numParcelasInput) {
        numParcelasInput.addEventListener('input', calcularValorParcela);
    }
    
    adicionarBotaoLogout();
    checkAuth();
});

window.onclick = (event) => {
    if (event.target === document.getElementById('editNotaModal')) fecharModal('editNotaModal');
    if (event.target === document.getElementById('editBoletoModal')) fecharModal('editBoletoModal');
};