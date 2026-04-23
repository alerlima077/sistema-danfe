// ========== VARIÁVEIS GLOBAIS ==========
let produtos = [];
let movimentacoes = [];
let inventarios = [];

// ========== FUNÇÕES DO FIREBASE PARA PRODUTOS ==========

// Carregar produtos do Firebase
async function carregarProdutos() {
    if (typeof db === 'undefined') {
        console.log('Firebase não disponível');
        return;
    }
    
    try {
        console.log('Carregando produtos do Firebase...');
        const snapshot = await db.collection('produtos').orderBy('nome', 'asc').get();
        produtos = [];
        snapshot.forEach(doc => {
            produtos.push({ id: doc.id, ...doc.data() });
        });
        console.log(`${produtos.length} produtos carregados`);
        renderizarProdutos();
        atualizarSelectsProdutos();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        mostrarNotificacao('Erro ao carregar produtos!', 'error');
    }
}

// Salvar produto no Firebase
async function salvarProdutoFirebase(produto) {
    if (typeof db !== 'undefined') {
        try {
            console.log('Tentando salvar produto:', produto);
            const docRef = await db.collection('produtos').add(produto);
            console.log('Produto salvo com ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Erro detalhado ao salvar produto:', error);
            throw error;
        }
    } else {
        console.log('Firebase não disponível');
        return null;
    }
}

// Atualizar produto no Firebase
async function atualizarProdutoFirebase(produtoId, dados) {
    if (typeof db !== 'undefined') {
        try {
            await db.collection('produtos').doc(produtoId).update(dados);
            console.log('Produto atualizado');
        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            throw error;
        }
    }
}

// Excluir produto do Firebase
async function excluirProdutoFirebase(produtoId) {
    if (typeof db !== 'undefined') {
        try {
            await db.collection('produtos').doc(produtoId).delete();
            console.log('Produto excluído');
        } catch (error) {
            console.error('Erro ao excluir produto:', error);
            throw error;
        }
    }
}

// ========== FUNÇÕES DE CÁLCULO ==========

// Calcular margem de lucro
function calcularMargemLucro(precoCusto, precoVenda) {
    if (!precoCusto || precoCusto <= 0) return 0;
    // Fórmula correta: ((Venda - Custo) / Custo) * 100
    return ((precoVenda - precoCusto) / precoCusto) * 100;
}

function atualizarMargemInfo() {
    const precoCusto = parseFloat(document.getElementById('produtoPrecoCusto')?.value) || 0;
    const precoVenda = parseFloat(document.getElementById('produtoPrecoVenda')?.value) || 0;
    const margemDiv = document.getElementById('margemInfo');
    
    console.log('Calculando margem:', { precoCusto, precoVenda }); // Debug
    
    if (margemDiv) {
        if (precoCusto > 0 && precoVenda > 0) {
            const margem = calcularMargemLucro(precoCusto, precoVenda);
            const margemFormatada = margem.toFixed(1);
            const lucroUnitario = precoVenda - precoCusto;
            
            let classe = '';
            let icone = '';
            if (margem >= 40) {
                classe = 'alta';
                icone = '🚀';
            } else if (margem >= 20) {
                classe = '';
                icone = '📈';
            } else {
                classe = 'baixa';
                icone = '⚠️';
            }
            
            margemDiv.className = `margem-info ${classe}`;
            margemDiv.innerHTML = `${icone} Margem: ${margemFormatada}% | Lucro por unidade: R$ ${lucroUnitario.toFixed(3)}`;
        } else {
            margemDiv.className = 'margem-info';
            margemDiv.innerHTML = '💰 Preencha custo e venda para ver a margem de lucro';
        }
    }
}

// ========== FUNÇÕES DAS ABAS ==========

function mostrarAba(aba) {
    // Esconder todas as abas
    document.getElementById('abaProdutos').style.display = 'none';
    document.getElementById('abaMovimentacoes').style.display = 'none';
    document.getElementById('abaInventario').style.display = 'none';
    document.getElementById('abaRelatorios').style.display = 'none';
    
    // Mostrar a aba selecionada
    document.getElementById(`aba${aba.charAt(0).toUpperCase() + aba.slice(1)}`).style.display = 'block';
    
    // Atualizar botões ativos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Expor função globalmente
window.mostrarAba = mostrarAba;

// ========== FUNÇÕES DE INTEGRAÇÃO COM NOTAS FISCAIS ==========

// Buscar ou criar produto pelo nome
async function buscarOuCriarProduto(produtoNota) {
    if (typeof db === 'undefined') return null;
    
    try {
        // Buscar produto pelo nome (case insensitive)
        const snapshot = await db.collection('produtos')
            .where('nome', '==', produtoNota.descricao)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            // Produto existe
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        } else {
            // Produto não existe, criar novo
            const novoProduto = {
                codigo: `AUTO-${Date.now()}`,
                nome: produtoNota.descricao,
                categoria: 'outros',
                unidade: produtoNota.unidade || 'UN',
                precoCusto: produtoNota.precoUnitario || 0,
                precoVenda: 0,
                margemLucro: 0,
                estoqueAtual: 0,
                estoqueMinimo: 0,
                createdAt: new Date().toISOString()
            };
            
            const docRef = await db.collection('produtos').add(novoProduto);
            return { id: docRef.id, ...novoProduto };
        }
    } catch (error) {
        console.error('Erro ao buscar/criar produto:', error);
        return null;
    }
}

// Atualizar estoque a partir de uma nota fiscal
async function atualizarEstoquePorNota(produtoNota, notaId) {
    if (typeof db === 'undefined') return;
    
    try {
        // Buscar ou criar o produto
        const produto = await buscarOuCriarProduto(produtoNota);
        if (!produto) return;
        
        // Nova quantidade em estoque
        const novaQuantidade = (produto.estoqueAtual || 0) + produtoNota.quantidade;
        
        // Atualizar produto no Firebase
        await db.collection('produtos').doc(produto.id).update({
            estoqueAtual: novaQuantidade,
            precoCusto: produtoNota.precoUnitario, // Atualizar preço de custo
            ultimaAtualizacao: new Date().toISOString()
        });
        
        // Registrar movimentação
        await registrarMovimentacao({
            produtoId: produto.id,
            produtoNome: produto.nome,
            tipo: 'entrada',
            quantidade: produtoNota.quantidade,
            motivo: 'nota_fiscal',
            notaId: notaId,
            precoUnitario: produtoNota.precoUnitario,
            dataHora: new Date().toISOString(),
            usuario: 'admin'
        });
        
        console.log(`Estoque atualizado: +${produtoNota.quantidade} ${produto.unidade} de ${produto.nome}`);
        
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error);
    }
}

// Registrar movimentação de estoque
async function registrarMovimentacao(movimentacao) {
    if (typeof db === 'undefined') return;
    
    try {
        await db.collection('movimentacoes').add(movimentacao);
        console.log('Movimentação registrada');
    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
    }
}

// Salvar movimentação (para ajustes manuais)
async function salvarMovimentacao(movimentacao) {
    return await registrarMovimentacao(movimentacao);
}

// Carregar movimentações do Firebase
async function carregarMovimentacoes(filtros = {}) {
    if (typeof db === 'undefined') return;
    
    try {
        let query = db.collection('movimentacoes').orderBy('dataHora', 'desc');
        
        if (filtros.dataInicio) {
            query = query.where('dataHora', '>=', filtros.dataInicio);
        }
        if (filtros.dataFim) {
            query = query.where('dataHora', '<=', filtros.dataFim);
        }
        if (filtros.produtoId && filtros.produtoId !== 'todos') {
            query = query.where('produtoId', '==', filtros.produtoId);
        }
        
        const snapshot = await query.get();
        movimentacoes = [];
        snapshot.forEach(doc => {
            movimentacoes.push({ id: doc.id, ...doc.data() });
        });
        
        renderizarMovimentacoes();
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
    }
}

// Renderizar movimentações na tabela
function renderizarMovimentacoes() {
    const tbody = document.getElementById('movimentacoesTableBody');
    if (!tbody) return;
    
    if (movimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Nenhuma movimentação</td>' + '</tr>';
        return;
    }
    
    tbody.innerHTML = movimentacoes.map(mov => `
        <tr>
            <td>${formatarDataHora(mov.dataHora)}</td>
            <td>${mov.produtoNome || mov.produtoId}</td>
            <td>${mov.tipo === 'entrada' ? '📥 Entrada' : '📤 Saída'}</td>
            <td>${mov.quantidade.toFixed(3)}</td>
            <td>${getMotivoTexto(mov.motivo)}</td>
        </tr>
    `).join('');
}

// Formatar data e hora
function formatarDataHora(dataHoraStr) {
    if (!dataHoraStr) return '-';
    const data = new Date(dataHoraStr);
    return data.toLocaleString('pt-BR');
}

// Obter texto do motivo
function getMotivoTexto(motivo) {
    const motivos = {
        'nota_fiscal': '📄 Nota Fiscal',
        'ajuste_manual': '✏️ Ajuste Manual',
        'inventario': '🔢 Inventário',
        'venda': '💰 Venda'
    };
    return motivos[motivo] || motivo;
}

// Filtrar movimentações
function filtrarMovimentacoes() {
    const dataInicio = document.getElementById('movDataInicio')?.value;
    const dataFim = document.getElementById('movDataFim')?.value;
    const produtoId = document.getElementById('movProdutoFiltro')?.value;
    
    carregarMovimentacoes({ dataInicio, dataFim, produtoId });
}

// Configurar event listeners das movimentações
function configurarMovimentacoesListeners() {
    const filtrarBtn = document.getElementById('filtrarMovimentacoesBtn');
    if (filtrarBtn) {
        filtrarBtn.addEventListener('click', filtrarMovimentacoes);
    }
}

// ========== RENDERIZAÇÃO DA TABELA DE PRODUTOS COM CORES NO ESTOQUE ==========

function renderizarProdutos() {
    const tbody = document.getElementById('produtosTableBody');
    if (!tbody) return;
    
    if (produtos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhum produto cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = produtos.map(produto => {
        // Calcular classe de cor do estoque
        let estoqueClass = '';
        let alertaTexto = '';
        const estoqueAtual = produto.estoqueAtual || 0;
        const estoqueMinimo = produto.estoqueMinimo || 0;
        
        if (estoqueMinimo > 0) {
            if (estoqueAtual <= 0) {
                estoqueClass = 'estoque-zero';
                alertaTexto = 'ZERADO!';
            } else if (estoqueAtual <= estoqueMinimo) {
                estoqueClass = 'estoque-critico';
                alertaTexto = 'CRÍTICO!';
            } else if (estoqueAtual <= estoqueMinimo * 1.2) {
                estoqueClass = 'estoque-alerta';
                alertaTexto = 'ALERTA!';
            }
        }
        
        // Formatar a célula de estoque com a classe correta
        const estoqueCelula = `<td class="${estoqueClass}">
            <strong>${estoqueAtual.toFixed(3)} ${produto.unidade || 'UN'}</strong>
            ${alertaTexto ? `<br><small>⚠️ ${alertaTexto}</small>` : ''}
            ${estoqueMinimo > 0 ? `<br><small style="color: #666;">Mín: ${estoqueMinimo.toFixed(3)}</small>` : ''}
        </td>`;
        
        return `
            <tr>
                <td>${produto.codigo || '-'}</td>
                <td><strong>${produto.nome}</strong><br><small>${produto.categoria || '-'}</small></td>
                ${estoqueCelula}
                <td>R$ ${(produto.precoCusto || 0).toFixed(3)}</td>
                <td>R$ ${(produto.precoVenda || 0).toFixed(3)}</td>
                <td>
                    <span class="margem-badge ${(produto.margemLucro || 0) >= 40 ? 'alta' : (produto.margemLucro || 0) >= 20 ? 'media' : 'baixa'}">
                        ${(produto.margemLucro || 0).toFixed(1)}%
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editarProduto('${produto.id}')">✏️ Editar</button>
                        <button class="btn-delete" onclick="excluirProduto('${produto.id}')">🗑️ Excluir</button>
                        <button class="btn-primary" style="background: #10b981;" onclick="atualizarPrecoVenda('${produto.id}')">💰 Preço</button>
                        <button class="btn-primary" style="background: #8b5cf6;" onclick="ajustarEstoque('${produto.id}')">📦 Estoque</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Atualizar selects que dependem dos produtos
function atualizarSelectsProdutos() {
    // Select de produtos no filtro de movimentações
    const selectProduto = document.getElementById('movProdutoFiltro');
    if (selectProduto) {
        selectProduto.innerHTML = '<option value="todos">Todos os produtos</option>';
        produtos.forEach(produto => {
            selectProduto.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome}</option>`;
        });
    }
    
    // Select de produtos no relatório
    const selectRelProduto = document.getElementById('relProduto');
    if (selectRelProduto) {
        selectRelProduto.innerHTML = '<option value="todos">Todos os produtos</option>';
        produtos.forEach(produto => {
            selectRelProduto.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome}</option>`;
        });
    }
    
    // Select de produtos na contagem
    const selectContagem = document.getElementById('contagemProduto');
    if (selectContagem) {
        selectContagem.innerHTML = '<option value="">Selecione um produto</option>';
        produtos.forEach(produto => {
            selectContagem.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome}</option>`;
        });
    }
}

// ========== CRUD DE PRODUTOS ==========

// Cadastrar produto - VERSÃO CORRIGIDA
const salvarProdutoBtn = document.getElementById('salvarProdutoBtn');
if (salvarProdutoBtn) {
    salvarProdutoBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation(); // Impede propagação
        
        if (!verificarPermissao()) return;
        
        const precoCusto = parseFloat(document.getElementById('produtoPrecoCusto').value) || 0;
        const precoVenda = parseFloat(document.getElementById('produtoPrecoVenda').value) || 0;
        
        const produto = {
            codigo: document.getElementById('produtoCodigo').value,
            nome: document.getElementById('produtoNome').value,
            categoria: document.getElementById('produtoCategoria').value,
            unidade: document.getElementById('produtoUnidade').value,
            precoCusto: precoCusto,
            precoVenda: precoVenda,
            margemLucro: calcularMargemLucro(precoCusto, precoVenda),
            estoqueAtual: 0,
            estoqueMinimo: parseFloat(document.getElementById('produtoEstoqueMinimo').value) || 0,
            createdAt: new Date().toISOString()
        };
        
        if (!produto.codigo || !produto.nome) {
            alert('Preencha código e nome do produto!');
            return;
        }
        
        try {
            await salvarProdutoFirebase(produto);
            await carregarProdutos();
            document.getElementById('produtoForm').reset();
            atualizarMargemInfo();
            mostrarNotificacao('Produto cadastrado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro:', error);
            mostrarNotificacao('Erro ao cadastrar produto!', 'error');
        }
    });
}

// Editar produto - VERSÃO CORRIGIDA COM VERIFICAÇÃO DO MODAL
window.editarProduto = async function(produtoId) {
    console.log('Editando produto:', produtoId);
    
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) {
        console.error('Produto não encontrado:', produtoId);
        mostrarNotificacao('Produto não encontrado!', 'error');
        return;
    }
    
    console.log('Produto encontrado:', produto);
    
    // Verificar se o modal existe, se não, criar
    let modal = document.getElementById('editarProdutoModal');
    let formContainer = document.getElementById('editarProdutoForm');
    
    if (!modal) {
        console.log('Modal não encontrado, criando...');
        // Criar o modal dinamicamente
        const modalDiv = document.createElement('div');
        modalDiv.id = 'editarProdutoModal';
        modalDiv.className = 'modal';
        modalDiv.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>✏️ Editar Produto</h2>
                    <button class="modal-close" onclick="fecharModal('editarProdutoModal')">&times;</button>
                </div>
                <div id="editarProdutoForm"></div>
            </div>
        `;
        document.body.appendChild(modalDiv);
        modal = document.getElementById('editarProdutoModal');
        formContainer = document.getElementById('editarProdutoForm');
    }
    
    if (!formContainer) {
        console.error('FormContainer não encontrado');
        mostrarNotificacao('Erro ao abrir edição!', 'error');
        return;
    }
    
    formContainer.innerHTML = `
        <form id="formEditarProduto" class="modal-form">
            <div class="form-group">
                <label>Código</label>
                <input type="text" id="edit_codigo" value="${produto.codigo || ''}" required>
            </div>
            <div class="form-group">
                <label>Nome</label>
                <input type="text" id="edit_nome" value="${produto.nome || ''}" required>
            </div>
            <div class="form-group">
                <label>Categoria</label>
                <select id="edit_categoria">
                    <option value="alimentacao" ${produto.categoria === 'alimentacao' ? 'selected' : ''}>🍽️ Alimentação</option>
                    <option value="bebidas" ${produto.categoria === 'bebidas' ? 'selected' : ''}>🥤 Bebidas</option>
                    <option value="limpeza" ${produto.categoria === 'limpeza' ? 'selected' : ''}>🧹 Limpeza</option>
                    <option value="higiene" ${produto.categoria === 'higiene' ? 'selected' : ''}>🚿 Higiene</option>
                    <option value="outros" ${produto.categoria === 'outros' ? 'selected' : ''}>📌 Outros</option>
                </select>
            </div>
            <div class="form-group">
                <label>Unidade</label>
                <select id="edit_unidade">
                    <option value="UN" ${produto.unidade === 'UN' ? 'selected' : ''}>UN</option>
                    <option value="KG" ${produto.unidade === 'KG' ? 'selected' : ''}>KG</option>
                    <option value="G" ${produto.unidade === 'G' ? 'selected' : ''}>G</option>
                    <option value="L" ${produto.unidade === 'L' ? 'selected' : ''}>L</option>
                    <option value="ML" ${produto.unidade === 'ML' ? 'selected' : ''}>ML</option>
                    <option value="PC" ${produto.unidade === 'PC' ? 'selected' : ''}>PC</option>
                    <option value="CX" ${produto.unidade === 'CX' ? 'selected' : ''}>CX</option>
                    <option value="FD" ${produto.unidade === 'FD' ? 'selected' : ''}>FD</option>
                </select>
            </div>
            <div class="form-group">
                <label>Preço de Custo (R$)</label>
                <input type="number" id="edit_precoCusto" step="0.001" value="${produto.precoCusto || 0}">
            </div>
            <div class="form-group">
                <label>Preço de Venda (R$)</label>
                <input type="number" id="edit_precoVenda" step="0.001" value="${produto.precoVenda || 0}">
            </div>
            <div class="form-group">
                <label>Estoque Atual</label>
                <input type="number" id="edit_estoqueAtual" step="0.001" value="${produto.estoqueAtual || 0}">
            </div>
            <div class="form-group">
                <label>Estoque Mínimo</label>
                <input type="number" id="edit_estoqueMinimo" step="0.001" value="${produto.estoqueMinimo || 0}">
            </div>
            <div class="modal-buttons">
                <button type="submit" class="btn-save">💾 Salvar</button>
                <button type="button" class="btn-cancel" onclick="fecharModal('editarProdutoModal')">Cancelar</button>
            </div>
        </form>
    `;
    
    modal.style.display = 'flex';
    
    // Adicionar evento para calcular margem em tempo real
    const precoCustoInput = document.getElementById('edit_precoCusto');
    const precoVendaInput = document.getElementById('edit_precoVenda');
    
    if (precoCustoInput && precoVendaInput) {
        const mostrarMargemEdit = () => {
            const custo = parseFloat(precoCustoInput.value) || 0;
            const venda = parseFloat(precoVendaInput.value) || 0;
            if (custo > 0 && venda > 0) {
                const margem = ((venda - custo) / custo) * 100;
                console.log(`Margem calculada: ${margem.toFixed(1)}%`);
            }
        };
        precoCustoInput.addEventListener('input', mostrarMargemEdit);
        precoVendaInput.addEventListener('input', mostrarMargemEdit);
    }
    
    // Remover event listener anterior se existir
    const form = document.getElementById('formEditarProduto');
    const novoForm = form.cloneNode(true);
    form.parentNode.replaceChild(novoForm, form);
    
    novoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const precoCusto = parseFloat(document.getElementById('edit_precoCusto').value) || 0;
        const precoVenda = parseFloat(document.getElementById('edit_precoVenda').value) || 0;
        const margemLucro = calcularMargemLucro(precoCusto, precoVenda);
        
        const dados = {
            codigo: document.getElementById('edit_codigo').value,
            nome: document.getElementById('edit_nome').value,
            categoria: document.getElementById('edit_categoria').value,
            unidade: document.getElementById('edit_unidade').value,
            precoCusto: precoCusto,
            precoVenda: precoVenda,
            margemLucro: margemLucro,
            estoqueAtual: parseFloat(document.getElementById('edit_estoqueAtual').value) || 0,
            estoqueMinimo: parseFloat(document.getElementById('edit_estoqueMinimo').value) || 0,
            updatedAt: new Date().toISOString()
        };
        
        try {
            await atualizarProdutoFirebase(produto.id, dados);
            await carregarProdutos();
            fecharModal('editarProdutoModal');
            mostrarNotificacao('Produto atualizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao atualizar:', error);
            mostrarNotificacao('Erro ao atualizar produto!', 'error');
        }
    });
};

// Excluir produto
window.excluirProduto = async function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    if (confirm(`Excluir produto "${produto.nome}"?`)) {
        try {
            await excluirProdutoFirebase(produtoId);
            await carregarProdutos();
            mostrarNotificacao('Produto excluído!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao excluir produto!', 'error');
        }
    }
};

// ========== FUNÇÃO 2: FECHAR MODAL ==========

// Fechar modal
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Expor função globalmente
window.fecharModal = fecharModal;

// ========== FUNÇÃO 3: ATUALIZAR PREÇO DE VENDA ==========

// Atualizar preço de venda de um produto
window.atualizarPrecoVenda = async function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    const novoPrecoVenda = prompt(
        `Produto: ${produto.nome}\n` +
        `Preço de custo atual: R$ ${(produto.precoCusto || 0).toFixed(3)}\n` +
        `Preço de venda atual: R$ ${(produto.precoVenda || 0).toFixed(3)}\n\n` +
        `Digite o novo preço de venda (R$):`,
        produto.precoVenda || 0
    );
    
    if (novoPrecoVenda !== null) {
        const precoVenda = parseFloat(novoPrecoVenda);
        if (!isNaN(precoVenda)) {
            const precoCusto = produto.precoCusto || 0;
            const margemLucro = calcularMargemLucro(precoCusto, precoVenda);
            
            try {
                await atualizarProdutoFirebase(produtoId, {
                    precoVenda: precoVenda,
                    margemLucro: margemLucro,
                    updatedAt: new Date().toISOString()
                });
                await carregarProdutos();
                mostrarNotificacao(`Preço de venda atualizado para R$ ${precoVenda.toFixed(3)}`, 'success');
            } catch (error) {
                mostrarNotificacao('Erro ao atualizar preço!', 'error');
            }
        } else {
            alert('Digite um valor válido!');
        }
    }
};

// ========== FUNÇÃO 4: AJUSTAR ESTOQUE (já existente, mantida) ==========

// Ajustar estoque manualmente
window.ajustarEstoque = async function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    const novaQuantidade = prompt(`Estoque atual: ${produto.estoqueAtual?.toFixed(3) || 0} ${produto.unidade || 'UN'}\n\nDigite a nova quantidade:`);
    
    if (novaQuantidade !== null) {
        const quantidade = parseFloat(novaQuantidade);
        if (!isNaN(quantidade)) {
            const diferenca = quantidade - (produto.estoqueAtual || 0);
            
            try {
                await atualizarProdutoFirebase(produtoId, { estoqueAtual: quantidade });
                await carregarProdutos();
                
                // Registrar movimentação
                if (diferenca !== 0 && typeof salvarMovimentacao === 'function') {
                    await salvarMovimentacao({
                        produtoId: produtoId,
                        tipo: diferenca > 0 ? 'entrada' : 'saida',
                        quantidade: Math.abs(diferenca),
                        motivo: 'ajuste_manual',
                        dataHora: new Date().toISOString(),
                        usuario: 'admin'
                    });
                }
                
                mostrarNotificacao(`Estoque ajustado para ${quantidade.toFixed(3)} ${produto.unidade}`, 'success');
            } catch (error) {
                mostrarNotificacao('Erro ao ajustar estoque!', 'error');
            }
        } else {
            alert('Digite um valor válido!');
        }
    }
};

// ========== INICIALIZAÇÃO ==========

// Configurar event listeners do formulário de produto
function inicializarFormularioProduto() {
    const precoCustoInput = document.getElementById('produtoPrecoCusto');
    const precoVendaInput = document.getElementById('produtoPrecoVenda');
    
    if (precoCustoInput) {
        precoCustoInput.addEventListener('input', atualizarMargemInfo);
    }
    if (precoVendaInput) {
        precoVendaInput.addEventListener('input', atualizarMargemInfo);
    }
}

// Chamar inicialização quando a página de estoque for carregada
function inicializarEstoque() {
    inicializarFormularioProduto();
    carregarProdutos();
    carregarMovimentacoes();
    configurarMovimentacoesListeners(); 
}

// Expor funções globalmente
window.inicializarEstoque = inicializarEstoque;