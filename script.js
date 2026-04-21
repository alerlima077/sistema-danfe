// ========== SISTEMA DE AUTENTICAÇÃO ==========
const SENHA_MASTER = 'admin123'; // Mude para a senha desejada
const SESSION_KEY = 'danfe_auth';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 horas em milissegundos

// Dados armazenados
let notas = [];
let boletos = {};

// Variáveis para armazenar funções originais
let funcoesOriginais = {};

// Verificar se já está logado
function checkAuth() {
    const authData = localStorage.getItem(SESSION_KEY);
    
    if (authData) {
        try {
            const { timestamp, authenticated } = JSON.parse(authData);
            const now = new Date().getTime();
            
            // Verificar se a sessão expirou
            if (authenticated && (now - timestamp) < SESSION_DURATION) {
                // Sessão válida
                document.body.classList.remove('logged-out');
                document.body.classList.add('logged-in');
                return true;
            } else {
                // Sessão expirada
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

// Login
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
        
        // Esconder overlay de login
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) {
            loginOverlay.style.display = 'none';
        }
        
        // Recarregar dados após login
        loadData();
        
        // Mostrar mensagem de boas-vindas
        mostrarNotificacao('Login realizado com sucesso!', 'success');
        
        return true;
    } else {
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = '❌ Senha incorreta! Tente novamente.';
            errorDiv.style.display = 'block';
            
            // Limpar erro após 3 segundos
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 3000);
        }
        
        return false;
    }
}

// Logout
function logout() {
    localStorage.removeItem(SESSION_KEY);
    document.body.classList.add('logged-out');
    document.body.classList.remove('logged-in');
    
    // Mostrar overlay de login novamente
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.style.display = 'flex';
    }
    
    // Limpar formulário de login
    const senhaInput = document.getElementById('senhaAcesso');
    if (senhaInput) senhaInput.value = '';
    
    // Limpar dados da tela
    const notasTableBody = document.getElementById('notasTableBody');
    if (notasTableBody) {
        notasTableBody.innerHTML = '<tr><td colspan="8" class="empty-message">Faça login para visualizar os dados</td></tr>';
    }
    
    mostrarNotificacao('Logout realizado com sucesso!', 'info');
}

// Mostrar notificação
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
            background: white;
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
        style.textContent = `
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    const cores = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    notificacao.style.background = cores[tipo] || cores.info;
    notificacao.style.color = 'white';
    notificacao.textContent = mensagem;
    notificacao.style.display = 'block';
    
    setTimeout(() => {
        notificacao.style.display = 'none';
    }, 3000);
}

// Adicionar botão de logout no header
function adicionarBotaoLogout() {
    const headerButtons = document.querySelector('.header-buttons');
    if (headerButtons && !document.getElementById('logoutBtn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logoutBtn';
        logoutBtn.className = 'btn-logout';
        logoutBtn.innerHTML = '🚪 Sair';
        logoutBtn.onclick = () => {
            if (confirm('Deseja realmente sair do sistema?')) {
                logout();
            }
        };
        headerButtons.appendChild(logoutBtn);
    }
}

// Verificar permissão antes de ações críticas
function verificarPermissao() {
    const authData = localStorage.getItem(SESSION_KEY);
    if (!authData) {
        mostrarNotificacao('Você precisa estar logado para fazer isso!', 'warning');
        return false;
    }
    
    try {
        const { authenticated, timestamp } = JSON.parse(authData);
        const now = new Date().getTime();
        
        if (!authenticated || (now - timestamp) >= SESSION_DURATION) {
            logout();
            mostrarNotificacao('Sessão expirada! Faça login novamente.', 'warning');
            return false;
        }
        
        return true;
    } catch(e) {
        return false;
    }
}

// ========== FUNÇÕES PRINCIPAIS DO SISTEMA ==========

// Carregar dados do localStorage
function loadData() {
    if (!verificarPermissao()) return;
    
    const storedNotas = localStorage.getItem('danfe_notas');
    const storedBoletos = localStorage.getItem('danfe_boletos');
    
    if (storedNotas) notas = JSON.parse(storedNotas);
    if (storedBoletos) boletos = JSON.parse(storedBoletos);
    
    renderNotas();
    atualizarSelectNotas();
    renderizarBoletosPage();
}

// Salvar dados
function saveData() {
    if (!verificarPermissao()) return;
    
    localStorage.setItem('danfe_notas', JSON.stringify(notas));
    localStorage.setItem('danfe_boletos', JSON.stringify(boletos));
}

// Calcular preço total
function calcularTotal(quantidade, precoUnitario) {
    return (quantidade * precoUnitario).toFixed(2);
}

// Formatar data
function formatarData(data) {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
}

// Renderizar notas na tabela
function renderNotas() {
    const tbody = document.getElementById('notasTableBody');
    if (!tbody) return;
    
    if (!verificarPermissao()) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">Faça login para visualizar as notas</td></tr>';
        return;
    }
    
    if (notas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-message">Nenhuma nota cadastrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = notas.map(nota => `
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
    `).join('');
}

// Cadastrar nota
function cadastrarNota(e) {
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
    
    if (!boletos[nota.id]) {
        boletos[nota.id] = [];
    }
    
    saveData();
    renderNotas();
    atualizarSelectNotas();
    e.target.reset();
    mostrarNotificacao('Nota cadastrada com sucesso!', 'success');
}

// Editar nota
window.editarNota = function(notaId) {
    if (!verificarPermissao()) return;
    
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;
    
    const modal = document.getElementById('editNotaModal');
    const formContainer = document.getElementById('editNotaForm');
    
    formContainer.innerHTML = `
        <form id="formEditNota" class="modal-form">
            <div class="form-group">
                <label>Nº NFe *</label>
                <input type="text" id="edit_nfeNumero" value="${nota.nfeNumero}" required>
            </div>
            <div class="form-group">
                <label>Data da Nota *</label>
                <input type="date" id="edit_dataNota" value="${nota.dataNota}" required>
            </div>
            <div class="form-group">
                <label>Fornecedor *</label>
                <input type="text" id="edit_fornecedor" value="${nota.fornecedor}" required>
            </div>
            <div class="form-group">
                <label>Endereço</label>
                <input type="text" id="edit_endereco" value="${nota.endereco || ''}">
            </div>
            <div class="form-group">
                <label>Telefone</label>
                <input type="text" id="edit_telefone" value="${nota.telefone || ''}">
            </div>
            <div class="form-group">
                <label>Descrição do Produto *</label>
                <input type="text" id="edit_descricao" value="${nota.descricao}" required>
            </div>
            <div class="form-group">
                <label>Quantidade *</label>
                <input type="number" id="edit_quantidade" step="0.01" value="${nota.quantidade}" required>
            </div>
            <div class="form-group">
                <label>Unidade</label>
                <select id="edit_unidade">
                    <option value="UN" ${nota.unidade === 'UN' ? 'selected' : ''}>UN</option>
                    <option value="PC" ${nota.unidade === 'PC' ? 'selected' : ''}>PC</option>
                    <option value="KG" ${nota.unidade === 'KG' ? 'selected' : ''}>KG</option>
                    <option value="L" ${nota.unidade === 'L' ? 'selected' : ''}>L</option>
                    <option value="M" ${nota.unidade === 'M' ? 'selected' : ''}>M</option>
                    <option value="CX" ${nota.unidade === 'CX' ? 'selected' : ''}>CX</option>
                </select>
            </div>
            <div class="form-group">
                <label>Preço Unitário *</label>
                <input type="number" id="edit_precoUnitario" step="0.01" value="${nota.precoUnitario}" required>
            </div>
            <div class="modal-buttons">
                <button type="submit" class="btn-save">💾 Salvar</button>
                <button type="button" class="btn-cancel" onclick="fecharModal('editNotaModal')">Cancelar</button>
            </div>
        </form>
    `;
    
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
        mostrarNotificacao('Nota atualizada com sucesso!', 'success');
    });
};

// Excluir nota
window.excluirNota = function(notaId) {
    if (!verificarPermissao()) return;
    
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;
    
    if (confirm(`Tem certeza que deseja excluir a nota ${nota.nfeNumero} - ${nota.fornecedor}?\n\nTodos os boletos relacionados também serão excluídos!`)) {
        notas = notas.filter(n => n.id !== notaId);
        delete boletos[notaId];
        saveData();
        renderNotas();
        atualizarSelectNotas();
        renderizarBoletosPage();
        mostrarNotificacao('Nota excluída com sucesso!', 'success');
    }
};

// Atualizar select de notas
function atualizarSelectNotas() {
    const select = document.getElementById('selectNotaBoleto');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Selecione uma nota --</option>';
    
    notas.forEach(nota => {
        const option = document.createElement('option');
        option.value = nota.id;
        option.textContent = `${nota.nfeNumero} - ${nota.fornecedor} (R$ ${nota.precoTotal})`;
        select.appendChild(option);
    });
}

// Renderizar boletos
function renderizarBoletosPage(notaId = null) {
    if (!verificarPermissao()) return;
    
    if (!notaId) {
        const select = document.getElementById('selectNotaBoleto');
        if (select) notaId = parseInt(select.value);
        if (!notaId) return;
    }
    
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;
    
    const boletosNota = boletos[notaId] || [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const tbody = document.getElementById('boletosTableBody');
    if (!tbody) return;
    
    if (boletosNota.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum boleto cadastrado para esta nota</td></tr>';
        return;
    }
    
    tbody.innerHTML = boletosNota.map((boleto, index) => {
        const dataVenc = new Date(boleto.dataVencimento);
        const diasDiff = Math.ceil((dataVenc - hoje) / (1000 * 60 * 60 * 24));
        
        let status = '';
        let statusClass = '';
        
        if (boleto.pago) {
            status = 'Pago ✅';
            statusClass = 'status-pago';
        } else if (diasDiff < 0) {
            status = 'Vencido ❌';
            statusClass = 'status-vencido';
        } else if (diasDiff <= 3) {
            status = 'Próximo ao Vencimento ⚠️';
            statusClass = 'status-proximo';
        } else {
            status = 'Pendente 📅';
            statusClass = 'status-pendente';
        }
        
        return `
            <tr>
                <td><strong>${nota.fornecedor}</strong></td>
                <td>${nota.nfeNumero}</td>
                <td>R$ ${parseFloat(boleto.valor).toFixed(2)}</td>
                <td>${formatarData(boleto.dataVencimento)}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td>
                    <div class="action-buttons">
                        ${!boleto.pago ? `<button class="btn-edit" onclick="editarBoleto(${notaId}, ${index})">✏️ Editar</button>` : ''}
                        ${!boleto.pago ? `<button class="btn-success" onclick="marcarBoletoPago(${notaId}, ${index})">💰 Pagar</button>` : '<span>✅ Pago</span>'}
                        <button class="btn-delete" onclick="excluirBoleto(${notaId}, ${index})">🗑️ Excluir</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Editar boleto
window.editarBoleto = function(notaId, boletoIndex) {
    if (!verificarPermissao()) return;
    
    const boleto = boletos[notaId][boletoIndex];
    if (!boleto) return;
    
    const modal = document.getElementById('editBoletoModal');
    const formContainer = document.getElementById('editBoletoForm');
    
    formContainer.innerHTML = `
        <form id="formEditBoleto" class="modal-form">
            <div class="form-group">
                <label>Valor do Boleto *</label>
                <input type="number" id="edit_valor" step="0.01" value="${boleto.valor}" required>
            </div>
            <div class="form-group">
                <label>Data de Vencimento *</label>
                <input type="date" id="edit_dataVencimento" value="${boleto.dataVencimento}" required>
            </div>
            <div class="modal-buttons">
                <button type="submit" class="btn-save">💾 Salvar</button>
                <button type="button" class="btn-cancel" onclick="fecharModal('editBoletoModal')">Cancelar</button>
            </div>
        </form>
    `;
    
    modal.style.display = 'flex';
    
    document.getElementById('formEditBoleto').addEventListener('submit', (e) => {
        e.preventDefault();
        
        boleto.valor = parseFloat(document.getElementById('edit_valor').value);
        boleto.dataVencimento = document.getElementById('edit_dataVencimento').value;
        
        saveData();
        renderizarBoletosPage(notaId);
        fecharModal('editBoletoModal');
        mostrarNotificacao('Boleto atualizado com sucesso!', 'success');
    });
};

// Excluir boleto
window.excluirBoleto = function(notaId, boletoIndex) {
    if (!verificarPermissao()) return;
    
    if (confirm('Tem certeza que deseja excluir este boleto?')) {
        boletos[notaId].splice(boletoIndex, 1);
        if (boletos[notaId].length === 0) {
            delete boletos[notaId];
        }
        saveData();
        renderizarBoletosPage(notaId);
        mostrarNotificacao('Boleto excluído com sucesso!', 'success');
    }
};

// Marcar boleto como pago
window.marcarBoletoPago = function(notaId, boletoIndex) {
    if (!verificarPermissao()) return;
    
    if (confirm('Confirmar pagamento deste boleto?')) {
        boletos[notaId][boletoIndex].pago = true;
        saveData();
        renderizarBoletosPage(notaId);
        renderNotas();
        mostrarNotificacao('Boleto marcado como pago!', 'success');
    }
};

// Ver boletos de uma nota
window.verBoletosNota = function(notaId) {
    if (!verificarPermissao()) return;
    
    document.getElementById('notasPage').style.display = 'none';
    document.getElementById('boletosPage').style.display = 'block';
    
    const select = document.getElementById('selectNotaBoleto');
    select.value = notaId;
    
    const event = new Event('change');
    select.dispatchEvent(event);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Fechar modal
window.fecharModal = function(modalId) {
    document.getElementById(modalId).style.display = 'none';
};

// Adicionar parcelas
function adicionarParcelas() {
    if (!verificarPermissao()) return;
    
    const select = document.getElementById('selectNotaBoleto');
    const notaId = parseInt(select.value);
    
    if (!notaId) {
        alert('Selecione uma nota fiscal primeiro!');
        return;
    }
    
    const valor = parseFloat(document.getElementById('parcelaValor').value);
    const dataInicial = document.getElementById('parcelaData').value;
    const numParcelas = parseInt(document.getElementById('numParcelas').value);
    
    if (!valor || !dataInicial) {
        alert('Preencha o valor e a data de vencimento!');
        return;
    }
    
    const nota = notas.find(n => n.id === notaId);
    if (!nota) return;
    
    const valorTotalNota = parseFloat(nota.precoTotal);
    const valorParcelas = valor * numParcelas;
    
    if (Math.abs(valorParcelas - valorTotalNota) > 0.01) {
        if (!confirm(`⚠️ Atenção! A soma das parcelas (R$ ${valorParcelas.toFixed(2)}) é diferente do valor total da nota (R$ ${valorTotalNota.toFixed(2)}).\n\nDeseja continuar mesmo assim?`)) {
            return;
        }
    }
    
    if (!boletos[notaId]) boletos[notaId] = [];
    
    for (let i = 0; i < numParcelas; i++) {
        const dataVenc = new Date(dataInicial);
        dataVenc.setMonth(dataVenc.getMonth() + i);
        
        boletos[notaId].push({
            valor: valor,
            dataVencimento: dataVenc.toISOString().split('T')[0],
            pago: false,
            id: Date.now() + i
        });
    }
    
    saveData();
    renderizarBoletosPage(notaId);
    
    document.getElementById('parcelaValor').value = '';
    document.getElementById('parcelaData').value = '';
    document.getElementById('numParcelas').value = '1';
    
    mostrarNotificacao(`${numParcelas} parcela(s) adicionada(s) com sucesso!`, 'success');
}

// Exportar para Excel
function exportarExcel() {
    if (!verificarPermissao()) return;
    
    let dadosExcel = [];
    
    dadosExcel.push(['SISTEMA DANFE - RELATÓRIO COMPLETO', '', '', '', '', '', '']);
    dadosExcel.push(['Data:', new Date().toLocaleDateString('pt-BR'), '', '', '', '', '']);
    dadosExcel.push(['', '', '', '', '', '', '']);
    dadosExcel.push(['NOTAS FISCAIS CADASTRADAS', '', '', '', '', '', '']);
    dadosExcel.push(['Data', 'NFe', 'Fornecedor', 'Endereço', 'Telefone', 'Produto', 'Quantidade', 'Valor Total']);
    
    notas.forEach(nota => {
        dadosExcel.push([
            formatarData(nota.dataNota),
            nota.nfeNumero,
            nota.fornecedor,
            nota.endereco || '',
            nota.telefone || '',
            `${nota.descricao} (${nota.unidade})`,
            nota.quantidade,
            `R$ ${nota.precoTotal}`
        ]);
    });
    
    dadosExcel.push(['', '', '', '', '', '', '', '']);
    dadosExcel.push(['BOLETOS', '', '', '', '', '', '', '']);
    dadosExcel.push(['Fornecedor', 'NFe', 'Valor Boleto', 'Vencimento', 'Status', 'Data Pagamento', '', '']);
    
    notas.forEach(nota => {
        const boletosNota = boletos[nota.id] || [];
        boletosNota.forEach(boleto => {
            const hoje = new Date();
            const venc = new Date(boleto.dataVencimento);
            let status = boleto.pago ? 'Pago' : 'Pendente';
            
            if (!boleto.pago) {
                const diasDiff = Math.ceil((venc - hoje) / (1000*60*60*24));
                if (diasDiff < 0) status = 'Vencido';
                else if (diasDiff <= 3) status = 'Próximo Vencimento';
            }
            
            dadosExcel.push([
                nota.fornecedor,
                nota.nfeNumero,
                `R$ ${parseFloat(boleto.valor).toFixed(2)}`,
                formatarData(boleto.dataVencimento),
                status,
                boleto.pago ? formatarData(new Date().toISOString().split('T')[0]) : '-'
            ]);
        });
    });
    
    const csv = dadosExcel.map(row => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `danfe_completo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    mostrarNotificacao('Relatório exportado com sucesso!', 'success');
}

// ========== EVENT LISTENERS E INICIALIZAÇÃO ==========

// Aguardar DOM carregar completamente
document.addEventListener('DOMContentLoaded', () => {
    // Configurar formulário de login
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const senha = document.getElementById('senhaAcesso').value;
            login(senha);
        });
    }
    
    // Configurar formulário de nota
    const notaForm = document.getElementById('notaForm');
    if (notaForm) {
        notaForm.addEventListener('submit', cadastrarNota);
    }
    
    // Configurar botão de adicionar parcelas
    const adicionarParcelasBtn = document.getElementById('adicionarParcelasBtn');
    if (adicionarParcelasBtn) {
        adicionarParcelasBtn.addEventListener('click', adicionarParcelas);
    }
    
    // Configurar select de notas
    const selectNota = document.getElementById('selectNotaBoleto');
    if (selectNota) {
        selectNota.addEventListener('change', (e) => {
            const notaId = parseInt(e.target.value);
            if (notaId) {
                document.getElementById('formBoletos').style.display = 'block';
                document.getElementById('listaBoletosContainer').style.display = 'block';
                renderizarBoletosPage(notaId);
            } else {
                document.getElementById('formBoletos').style.display = 'none';
                document.getElementById('listaBoletosContainer').style.display = 'none';
            }
        });
    }
    
    // Configurar navegação
    const boletosPageBtn = document.getElementById('boletosPageBtn');
    if (boletosPageBtn) {
        boletosPageBtn.addEventListener('click', () => {
            document.getElementById('notasPage').style.display = 'none';
            document.getElementById('boletosPage').style.display = 'block';
            atualizarSelectNotas();
        });
    }
    
    // Configurar botão de exportar
    const exportBtn = document.getElementById('exportExcelBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportarExcel);
    }
    
    // Adicionar botão de logout
    adicionarBotaoLogout();
    
    // Configurar botão voltar
    const headerButtons = document.querySelector('.header-buttons');
    if (headerButtons) {
        const voltarBtn = document.createElement('button');
        voltarBtn.textContent = '◀ Voltar para Notas';
        voltarBtn.className = 'btn-secondary';
        voltarBtn.style.display = 'none';
        voltarBtn.onclick = () => {
            document.getElementById('boletosPage').style.display = 'none';
            document.getElementById('notasPage').style.display = 'block';
            voltarBtn.style.display = 'none';
            document.getElementById('boletosPageBtn').style.display = 'flex';
        };
        headerButtons.appendChild(voltarBtn);
        
        // Observer para mostrar/esconder botão voltar
        const observer = new MutationObserver(() => {
            const boletosPage = document.getElementById('boletosPage');
            if (boletosPage && boletosPage.style.display === 'block') {
                voltarBtn.style.display = 'flex';
                document.getElementById('boletosPageBtn').style.display = 'none';
            } else {
                voltarBtn.style.display = 'none';
                document.getElementById('boletosPageBtn').style.display = 'flex';
            }
        });
        observer.observe(document.getElementById('boletosPage'), { attributes: true, attributeFilter: ['style'] });
    }
    
    // Verificar autenticação
    checkAuth();
});

// Fechar modais ao clicar fora
window.onclick = (event) => {
    const modalNota = document.getElementById('editNotaModal');
    const modalBoleto = document.getElementById('editBoletoModal');
    if (event.target === modalNota) {
        modalNota.style.display = 'none';
    }
    if (event.target === modalBoleto) {
        modalBoleto.style.display = 'none';
    }
};