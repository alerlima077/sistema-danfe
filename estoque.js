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

// Carregar inventários do Firebase
async function carregarInventarios() {
    if (typeof db === 'undefined') return;
    
    try {
        const snapshot = await db.collection('inventarios').orderBy('dataInventario', 'desc').get();
        inventarios = [];
        snapshot.forEach(doc => {
            inventarios.push({ id: doc.id, ...doc.data() });
        });
        renderizarInventarios();
    } catch (error) {
        console.error('Erro ao carregar inventários:', error);
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

// Salvar inventário no Firebase
async function salvarInventarioFirebase(inventario) {
    if (typeof db !== 'undefined') {
        try {
            const docRef = await db.collection('inventarios').add(inventario);
            console.log('Inventário salvo com ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Erro ao salvar inventário:', error);
            throw error;
        }
    }
    return null;
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

// Excluir inventário do Firebase
async function excluirInventarioFirebase(inventarioId) {
    if (typeof db !== 'undefined') {
        try {
            await db.collection('inventarios').doc(inventarioId).delete();
            console.log('Inventário excluído');
        } catch (error) {
            console.error('Erro ao excluir inventário:', error);
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
    if (typeof db === 'undefined') {
        console.log('Firebase não disponível');
        return;
    }
    
    try {
        console.log('🔄 Carregando movimentações com filtros:', filtros);
        
        // Buscar todas movimentações
        const snapshot = await db.collection('movimentacoes').orderBy('dataHora', 'desc').get();
        let todasMovimentacoes = [];
        
        snapshot.forEach(doc => {
            todasMovimentacoes.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`📦 Total de movimentações: ${todasMovimentacoes.length}`);
        
        // Aplicar filtros manualmente (frontend)
        let movimentacoesFiltradas = [...todasMovimentacoes];
        
        // Filtrar por data de início
        if (filtros.dataInicio && filtros.dataInicio !== '') {
            const dataInicioObj = new Date(filtros.dataInicio);
            dataInicioObj.setHours(0, 0, 0, 0);
            movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => {
                const movData = new Date(mov.dataHora);
                return movData >= dataInicioObj;
            });
            console.log(`📅 Filtro data início: ${movimentacoesFiltradas.length} movimentações`);
        }
        
        // Filtrar por data de fim
        if (filtros.dataFim && filtros.dataFim !== '') {
            const dataFimObj = new Date(filtros.dataFim);
            dataFimObj.setHours(23, 59, 59, 999);
            movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => {
                const movData = new Date(mov.dataHora);
                return movData <= dataFimObj;
            });
            console.log(`📅 Filtro data fim: ${movimentacoesFiltradas.length} movimentações`);
        }
        
        // Filtrar por produto
        if (filtros.produtoId && filtros.produtoId !== 'todos' && filtros.produtoId !== '') {
            movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => mov.produtoId === filtros.produtoId);
            console.log(`📦 Filtro produto: ${movimentacoesFiltradas.length} movimentações`);
        }
        
        movimentacoes = movimentacoesFiltradas;
        renderizarMovimentacoes();
        
    } catch (error) {
        console.error('❌ Erro ao carregar movimentações:', error);
        mostrarNotificacao('Erro ao carregar movimentações!', 'error');
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

// Filtrar movimentações - VERSÃO CORRIGIDA
function filtrarMovimentacoes() {
    console.log('=== FILTRANDO MOVIMENTAÇÕES ===');
    
    const dataInicio = document.getElementById('movDataInicio')?.value;
    const dataFim = document.getElementById('movDataFim')?.value;
    const produtoId = document.getElementById('movProdutoFiltro')?.value;
    
    console.log('Filtros aplicados:', { dataInicio, dataFim, produtoId });
    
    carregarMovimentacoes({ dataInicio, dataFim, produtoId });
}

// Limpar filtros de movimentações
function limparFiltrosMovimentacoes() {
    console.log('🧹 Limpando filtros...');
    const dataInicioInput = document.getElementById('movDataInicio');
    const dataFimInput = document.getElementById('movDataFim');
    const produtoSelect = document.getElementById('movProdutoFiltro');
    
    if (dataInicioInput) dataInicioInput.value = '';
    if (dataFimInput) dataFimInput.value = '';
    if (produtoSelect) produtoSelect.value = 'todos';
    
    carregarMovimentacoes({});
    mostrarNotificacao('Filtros limpos!', 'info');
}

// Configurar event listeners das movimentações
function configurarMovimentacoesListeners() {
    console.log('⚙️ Configurando listeners de movimentações...');
    
    const filtrarBtn = document.getElementById('filtrarMovimentacoesBtn');
    if (filtrarBtn) {
        // Remover qualquer event listener anterior usando onclick
        filtrarBtn.onclick = null;
        
        // Adicionar novo event listener
        filtrarBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Filtrar clicado!');
            filtrarMovimentacoes();
        };
        console.log('✅ Botão Filtrar configurado com onclick');
    } else {
        console.log('❌ Botão filtrarMovimentacoesBtn não encontrado!');
    }
    
    const limparFiltrosBtn = document.getElementById('limparFiltrosBtn');
    if (limparFiltrosBtn) {
        limparFiltrosBtn.onclick = null;
        limparFiltrosBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Limpar Filtros clicado!');
            limparFiltrosMovimentacoes();
        };
        console.log('✅ Botão Limpar Filtros configurado com onclick');
    }
}

// ========== FUNÇÕES DA TELA DE CONTAGEM ==========

// Mostrar/esconder formulário de contagem
function toggleFormContagem(mostrar) {
    const formContagem = document.getElementById('formContagem');
    if (formContagem) {
        formContagem.style.display = mostrar ? 'block' : 'none';
    }
    if (!mostrar) {
        // Limpar formulário
        document.getElementById('contagemProduto').value = '';
        document.getElementById('quantidadeSistema').value = '';
        document.getElementById('quantidadeContada').value = '';
        document.getElementById('diferencaContagem').value = '';
        document.getElementById('observacaoContagem').value = '';
    }
}

// Carregar quantidade do sistema quando produto for selecionado
function carregarQuantidadeSistema() {
    const produtoId = document.getElementById('contagemProduto').value;
    const quantidadeSistemaInput = document.getElementById('quantidadeSistema');
    
    if (produtoId) {
        const produto = produtos.find(p => p.id === produtoId);
        if (produto) {
            quantidadeSistemaInput.value = `${(produto.estoqueAtual || 0).toFixed(3)} ${produto.unidade || 'UN'}`;
            // Armazenar o valor numérico para cálculo
            quantidadeSistemaInput.setAttribute('data-valor', produto.estoqueAtual || 0);
        }
    } else {
        quantidadeSistemaInput.value = '';
        quantidadeSistemaInput.removeAttribute('data-valor');
    }
    calcularDiferenca();
}

// Calcular diferença entre sistema e contado
function calcularDiferenca() {
    const quantidadeContada = parseFloat(document.getElementById('quantidadeContada').value) || 0;
    const quantidadeSistema = parseFloat(document.getElementById('quantidadeSistema')?.getAttribute('data-valor')) || 0;
    const diferenca = quantidadeContada - quantidadeSistema;
    const diferencaInput = document.getElementById('diferencaContagem');
    
    if (diferencaInput) {
        diferencaInput.value = `${diferenca > 0 ? '+' : ''}${diferenca.toFixed(3)}`;
        
        // Aplicar classe de cor
        if (diferenca > 0) {
            diferencaInput.className = 'diferenca-positiva';
        } else if (diferenca < 0) {
            diferencaInput.className = 'diferenca-negativa';
        } else {
            diferencaInput.className = 'diferenca-zero';
        }
    }
    
    return diferenca;
}

// Salvar contagem
async function salvarContagem() {
    const produtoId = document.getElementById('contagemProduto').value;
    const quantidadeContada = parseFloat(document.getElementById('quantidadeContada').value);
    const observacao = document.getElementById('observacaoContagem').value;
    
    if (!produtoId) {
        alert('Selecione um produto!');
        return;
    }
    
    if (isNaN(quantidadeContada) || quantidadeContada < 0) {
        alert('Digite uma quantidade válida!');
        return;
    }
    
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    const quantidadeSistema = produto.estoqueAtual || 0;
    const diferenca = quantidadeContada - quantidadeSistema;
    
    // Confirmar se a diferença é significativa
    if (Math.abs(diferenca) > 0) {
        const mensagem = diferenca > 0 
            ? `📈 Aumento de ${diferenca.toFixed(3)} ${produto.unidade}\nO estoque será ajustado para ${quantidadeContada.toFixed(3)} ${produto.unidade}\n\nDeseja continuar?`
            : `📉 Diminuição de ${Math.abs(diferenca).toFixed(3)} ${produto.unidade}\nO estoque será ajustado para ${quantidadeContada.toFixed(3)} ${produto.unidade}\n\nDeseja continuar?`;
        
        if (!confirm(mensagem)) {
            return;
        }
    }
    
    try {
        // Atualizar estoque do produto
        await atualizarProdutoFirebase(produtoId, { estoqueAtual: quantidadeContada });
        
        // Registrar inventário
        const inventario = {
            produtoId: produtoId,
            produtoNome: produto.nome,
            produtoCodigo: produto.codigo,
            unidade: produto.unidade,
            quantidadeSistema: quantidadeSistema,
            quantidadeContada: quantidadeContada,
            diferenca: diferenca,
            observacao: observacao || (diferenca === 0 ? 'Contagem conferida' : diferenca > 0 ? 'Ajuste positivo' : 'Ajuste negativo'),
            dataInventario: new Date().toISOString(),
            usuario: 'admin'
        };
        
        await salvarInventarioFirebase(inventario);
        
        // Registrar movimentação
        if (diferenca !== 0) {
            await registrarMovimentacao({
                produtoId: produtoId,
                produtoNome: produto.nome,
                tipo: diferenca > 0 ? 'entrada' : 'saida',
                quantidade: Math.abs(diferenca),
                motivo: 'inventario',
                observacao: observacao,
                dataHora: new Date().toISOString(),
                usuario: 'admin'
            });
        }
        
        // Recarregar dados
        await carregarProdutos();
        await carregarInventarios();
        
        // Limpar e fechar formulário
        toggleFormContagem(false);
        
        mostrarNotificacao(`Contagem finalizada! ${diferenca !== 0 ? `Estoque ajustado em ${diferenca.toFixed(3)} ${produto.unidade}` : 'Estoque conferido'}`, 'success');
        
    } catch (error) {
        console.error('Erro ao salvar contagem:', error);
        mostrarNotificacao('Erro ao salvar contagem!', 'error');
    }
}

// Renderizar inventários na tabela
function renderizarInventarios() {
    const tbody = document.getElementById('inventarioTableBody');
    if (!tbody) return;
    
    if (inventarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-message">Nenhuma contagem registrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = inventarios.map(inv => {
        const diferencaClass = inv.diferenca > 0 ? 'diferenca-positiva' : (inv.diferenca < 0 ? 'diferenca-negativa' : 'diferenca-zero');
        const diferencaSinal = inv.diferenca > 0 ? '+' : '';
        
        return `
            <tr>
                <td>${formatarDataHora(inv.dataInventario)}</td>
                <td><strong>${inv.produtoNome}</strong><br><small>${inv.produtoCodigo || '-'}</small></td>
                <td>${inv.quantidadeSistema.toFixed(3)} ${inv.unidade}</td>
                <td>${inv.quantidadeContada.toFixed(3)} ${inv.unidade}</td>
                <td><span class="${diferencaClass}">${diferencaSinal}${inv.diferenca.toFixed(3)} ${inv.unidade}</span></td>
                <td>${inv.observacao || '-'}</td>
                <td>
                    <button class="btn-delete" onclick="excluirInventario('${inv.id}')" title="Excluir">🗑️</button>
                 </td>
            </tr>
        `;
    }).join('');
}

// Excluir inventário
window.excluirInventario = async function(inventarioId) {
    if (confirm('Excluir este registro de contagem? Isso não afetará o estoque atual.')) {
        try {
            await excluirInventarioFirebase(inventarioId);
            await carregarInventarios();
            mostrarNotificacao('Registro excluído!', 'success');
        } catch (error) {
            mostrarNotificacao('Erro ao excluir!', 'error');
        }
    }
};

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
            selectContagem.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome} (Estoque: ${(produto.estoqueAtual || 0).toFixed(3)} ${produto.unidade || 'UN'})</option>`;
        });
    }

    // Select de produtos no filtro de movimentações
    const selectProdutoMov = document.getElementById('movProdutoFiltro');
    if (selectProdutoMov) {
        selectProdutoMov.innerHTML = '<option value="todos">📋 Todos os produtos</option>';
        produtos.forEach(produto => {
            selectProdutoMov.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome}</option>`;
        });
        console.log(`Select de movimentações populado com ${produtos.length} produtos`);
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

// Ajustar estoque manualmente - (salva o nome do produto)
window.ajustarEstoque = async function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    const novaQuantidade = prompt(`Produto: ${produto.nome}\nEstoque atual: ${produto.estoqueAtual?.toFixed(3) || 0} ${produto.unidade || 'UN'}\n\nDigite a nova quantidade:`);
    
    if (novaQuantidade !== null) {
        const quantidade = parseFloat(novaQuantidade);
        if (!isNaN(quantidade)) {
            const diferenca = quantidade - (produto.estoqueAtual || 0);
            
            try {
                await atualizarProdutoFirebase(produtoId, { 
                    estoqueAtual: quantidade,
                    ultimaAtualizacao: new Date().toISOString()
                });
                await carregarProdutos();
                
                // Registrar movimentação com o nome do produto
                if (diferenca !== 0 && typeof registrarMovimentacao === 'function') {
                    await registrarMovimentacao({
                        produtoId: produtoId,
                        produtoNome: produto.nome,  // ⭐ NOME DO PRODUTO
                        tipo: diferenca > 0 ? 'entrada' : 'saida',
                        quantidade: Math.abs(diferenca),
                        motivo: 'ajuste_manual',
                        observacao: `Ajuste manual de ${produto.estoqueAtual?.toFixed(3)} para ${quantidade.toFixed(3)}`,
                        dataHora: new Date().toISOString(),
                        usuario: 'admin'
                    });
                }
                
                mostrarNotificacao(`Estoque ajustado para ${quantidade.toFixed(3)} ${produto.unidade}`, 'success');
            } catch (error) {
                console.error('Erro ao ajustar estoque:', error);
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

// Configurar event listeners do inventário
function configurarInventarioListeners() {
    console.log('Configurando listeners do inventário...');
    
    const novaContagemBtn = document.getElementById('novaContagemBtn');
    if (novaContagemBtn) {
        // Remover event listeners antigos
        const novoBotao = novaContagemBtn.cloneNode(true);
        novaContagemBtn.parentNode.replaceChild(novoBotao, novaContagemBtn);
        
        novoBotao.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Botão Nova Contagem clicado!');
            const formContagem = document.getElementById('formContagem');
            if (formContagem) {
                formContagem.style.display = 'block';
                // Limpar formulário ao abrir
                document.getElementById('contagemProduto').value = '';
                document.getElementById('quantidadeSistema').value = '';
                document.getElementById('quantidadeContada').value = '';
                document.getElementById('diferencaContagem').value = '';
                document.getElementById('observacaoContagem').value = '';
            } else {
                console.error('Formulário formContagem não encontrado!');
            }
        });
    } else {
        console.error('Botão novaContagemBtn não encontrado!');
    }
    
    const cancelarContagemBtn = document.getElementById('cancelarContagemBtn');
    if (cancelarContagemBtn) {
        const novoCancelar = cancelarContagemBtn.cloneNode(true);
        cancelarContagemBtn.parentNode.replaceChild(novoCancelar, cancelarContagemBtn);
        
        novoCancelar.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Cancelar clicado');
            const formContagem = document.getElementById('formContagem');
            if (formContagem) {
                formContagem.style.display = 'none';
            }
        });
    }
    
    const salvarContagemBtn = document.getElementById('salvarContagemBtn');
    if (salvarContagemBtn) {
        const novoSalvar = salvarContagemBtn.cloneNode(true);
        salvarContagemBtn.parentNode.replaceChild(novoSalvar, salvarContagemBtn);
        
        novoSalvar.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Salvar contagem clicado');
            salvarContagem();
        });
    }
    
    const contagemProduto = document.getElementById('contagemProduto');
    if (contagemProduto) {
        contagemProduto.addEventListener('change', function() {
            console.log('Produto selecionado:', this.value);
            carregarQuantidadeSistema();
        });
    }
    
    const quantidadeContada = document.getElementById('quantidadeContada');
    if (quantidadeContada) {
        quantidadeContada.addEventListener('input', function() {
            console.log('Quantidade contada alterada:', this.value);
            calcularDiferenca();
        });
    }
    
    console.log('Listeners do inventário configurados!');
}

// Chamar inicialização quando a página de estoque for carregada
function inicializarEstoque() {
    inicializarFormularioProduto();
    carregarProdutos();
    carregarMovimentacoes();
    carregarInventarios();      // ⭐ NOVO: Carregar histórico de inventários
    configurarMovimentacoesListeners();
    configurarInventarioListeners();  // ⭐ NOVO: Configurar listeners do inventário
}

// Expor funções globalmente
window.inicializarEstoque = inicializarEstoque;
window.carregarInventarios = carregarInventarios;
window.toggleFormContagem = toggleFormContagem;
window.carregarQuantidadeSistema = carregarQuantidadeSistema;
window.calcularDiferenca = calcularDiferenca;
window.salvarContagem = salvarContagem;

// Teste automático ao carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== INICIANDO TESTE DO INVENTÁRIO ===');
    
    const btnNovaContagem = document.getElementById('novaContagemBtn');
    const formContagem = document.getElementById('formContagem');
    const selectProduto = document.getElementById('contagemProduto');
    const qtdSistema = document.getElementById('quantidadeSistema');
    const qtdContada = document.getElementById('quantidadeContada');
    const diferenca = document.getElementById('diferencaContagem');
    
    console.log('Botão Nova Contagem:', btnNovaContagem ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    console.log('Formulário Contagem:', formContagem ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    console.log('Select Produto:', selectProduto ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    console.log('Qtd Sistema:', qtdSistema ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    console.log('Qtd Contada:', qtdContada ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    console.log('Diferença:', diferenca ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO');
    
    // Função para carregar quantidade do sistema
    function carregarQuantidadeSistemaTeste() {
        const produtoId = selectProduto.value;
        console.log('Produto selecionado ID:', produtoId);
        
        // Tentar acessar produtos de diferentes formas
        let produtosLista = null;
        
        if (typeof produtos !== 'undefined') {
            produtosLista = produtos;
            console.log('Usando variável produtos (global)');
        } else if (window.produtos) {
            produtosLista = window.produtos;
            console.log('Usando window.produtos');
        } else {
            console.log('Variável produtos não encontrada!');
        }
        
        if (produtoId && produtosLista) {
            const produto = produtosLista.find(p => p.id === produtoId);
            console.log('Produto encontrado:', produto);
            
            if (produto) {
                const qtd = produto.estoqueAtual || 0;
                const unidade = produto.unidade || 'UN';
                qtdSistema.value = `${qtd.toFixed(3)} ${unidade}`;
                qtdSistema.setAttribute('data-valor', qtd);
                console.log('Quantidade sistema carregada:', qtd);
            } else {
                console.log('Produto não encontrado no array');
                qtdSistema.value = 'Produto não encontrado';
            }
        } else {
            console.log('Sem produto selecionado ou produtos não carregados');
            qtdSistema.value = '';
        }
        calcularDiferencaTeste();
    }
    
    // Função para calcular diferença
    function calcularDiferencaTeste() {
        const contada = parseFloat(qtdContada.value) || 0;
        const sistema = parseFloat(qtdSistema.getAttribute('data-valor')) || 0;
        const diff = contada - sistema;
        console.log(`Cálculo: ${contada} - ${sistema} = ${diff}`);
        diferenca.value = `${diff > 0 ? '+' : ''}${diff.toFixed(3)}`;
        
        if (diff > 0) {
            diferenca.className = 'diferenca-positiva';
        } else if (diff < 0) {
            diferenca.className = 'diferenca-negativa';
        } else {
            diferenca.className = 'diferenca-zero';
        }
    }
    
    // Função para popular o select de produtos
    function popularSelectProdutos() {
        let produtosLista = null;
        
        if (typeof produtos !== 'undefined') {
            produtosLista = produtos;
        } else if (window.produtos) {
            produtosLista = window.produtos;
        }
        
        if (selectProduto && produtosLista && produtosLista.length > 0) {
            console.log('Populando select com', produtosLista.length, 'produtos');
            selectProduto.innerHTML = '<option value="">-- Selecione um produto --</option>';
            produtosLista.forEach(produto => {
                const estoqueAtual = (produto.estoqueAtual || 0).toFixed(3);
                selectProduto.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome} (Estoque: ${estoqueAtual} ${produto.unidade || 'UN'})</option>`;
            });
        } else {
            console.log('Aguardando produtos carregarem...');
            // Tentar novamente após 1 segundo
            setTimeout(popularSelectProdutos, 1000);
        }
    }
    
    // Configurar eventos do botão Nova Contagem
    if (btnNovaContagem && formContagem) {
        btnNovaContagem.onclick = function() {
            console.log('Botão Nova Contagem clicado!');
            formContagem.style.display = 'block';
            popularSelectProdutos();
        };
    }
    
    // Configurar eventos do select e inputs
    if (selectProduto) {
        selectProduto.addEventListener('change', carregarQuantidadeSistemaTeste);
    }
    
    if (qtdContada) {
        qtdContada.addEventListener('input', calcularDiferencaTeste);
    }
    
    // Configurar botão cancelar
    const cancelarBtn = document.getElementById('cancelarContagemBtn');
    if (cancelarBtn) {
        cancelarBtn.onclick = function() {
            formContagem.style.display = 'none';
            selectProduto.value = '';
            qtdSistema.value = '';
            qtdContada.value = '';
            diferenca.value = '';
        };
    }
    
    // Configurar botão salvar - VERSÃO COMPLETA
    const salvarBtn = document.getElementById('salvarContagemBtn');
    if (salvarBtn) {
        salvarBtn.onclick = async function() {
            console.log('Salvar contagem clicado');
            const produtoId = selectProduto.value;
            const quantidadeContada = parseFloat(qtdContada.value);
            const observacao = document.getElementById('observacaoContagem').value;
            
            if (!produtoId) {
                alert('Selecione um produto!');
                return;
            }
            
            if (isNaN(quantidadeContada) || quantidadeContada < 0) {
                alert('Digite uma quantidade válida!');
                return;
            }
            
            // Buscar produto
            let produtosLista = null;
            if (typeof produtos !== 'undefined') {
                produtosLista = produtos;
            } else if (window.produtos) {
                produtosLista = window.produtos;
            }
            
            const produto = produtosLista.find(p => p.id === produtoId);
            if (!produto) {
                alert('Produto não encontrado!');
                return;
            }
            
            const quantidadeSistema = produto.estoqueAtual || 0;
            const diferenca = quantidadeContada - quantidadeSistema;
            
            // Confirmar se a diferença é significativa
            if (Math.abs(diferenca) > 0) {
                const mensagem = diferenca > 0 
                    ? `📈 Aumento de ${diferenca.toFixed(3)} ${produto.unidade}\nO estoque será ajustado para ${quantidadeContada.toFixed(3)} ${produto.unidade}\n\nDeseja continuar?`
                    : `📉 Diminuição de ${Math.abs(diferenca).toFixed(3)} ${produto.unidade}\nO estoque será ajustado para ${quantidadeContada.toFixed(3)} ${produto.unidade}\n\nDeseja continuar?`;
                
                if (!confirm(mensagem)) {
                    return;
                }
            }
            
            try {
                // Atualizar estoque do produto no Firebase
                if (typeof db !== 'undefined') {
                    await db.collection('produtos').doc(produtoId).update({
                        estoqueAtual: quantidadeContada,
                        ultimaAtualizacao: new Date().toISOString()
                    });
                }
                
                // Registrar inventário
                const inventario = {
                    produtoId: produtoId,
                    produtoNome: produto.nome,
                    produtoCodigo: produto.codigo,
                    unidade: produto.unidade,
                    quantidadeSistema: quantidadeSistema,
                    quantidadeContada: quantidadeContada,
                    diferenca: diferenca,
                    observacao: observacao || (diferenca === 0 ? 'Contagem conferida' : diferenca > 0 ? 'Ajuste positivo' : 'Ajuste negativo'),
                    dataInventario: new Date().toISOString(),
                    usuario: 'admin'
                };
                
                if (typeof db !== 'undefined') {
                    await db.collection('inventarios').add(inventario);
                }
                
                // Registrar movimentação se houver diferença
                if (diferenca !== 0 && typeof db !== 'undefined') {
                    await db.collection('movimentacoes').add({
                        produtoId: produtoId,
                        produtoNome: produto.nome,
                        tipo: diferenca > 0 ? 'entrada' : 'saida',
                        quantidade: Math.abs(diferenca),
                        motivo: 'inventario',
                        observacao: observacao,
                        dataHora: new Date().toISOString(),
                        usuario: 'admin'
                    });
                }
                
                // Recarregar dados
                if (typeof carregarProdutos === 'function') {
                    await carregarProdutos();
                }
                if (typeof carregarInventarios === 'function') {
                    await carregarInventarios();
                }
                
                // Fechar formulário
                formContagem.style.display = 'none';
                selectProduto.value = '';
                qtdSistema.value = '';
                qtdContada.value = '';
                diferenca.value = '';
                document.getElementById('observacaoContagem').value = '';
                
                alert(`✅ Contagem finalizada!\n\nProduto: ${produto.nome}\nEstoque ajustado para ${quantidadeContada.toFixed(3)} ${produto.unidade}\nDiferença: ${diferenca > 0 ? '+' : ''}${diferenca.toFixed(3)} ${produto.unidade}`);
                
            } catch (error) {
                console.error('Erro ao salvar contagem:', error);
                alert('❌ Erro ao salvar contagem! Verifique o console.');
            }
        };
    }

    // ========== CONFIGURAÇÃO FORÇADA DOS BOTÕES ==========
// Este código será executado quando a página carregar

// Aguardar o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Iniciando configuração forçada dos botões...');
    
    // Configurar botão Filtrar
    const filtrarBtn = document.getElementById('filtrarMovimentacoesBtn');
    if (filtrarBtn) {
        console.log('✅ Botão Filtrar encontrado!');
        filtrarBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Filtrar CLICADO!');
            
            const dataInicio = document.getElementById('movDataInicio')?.value;
            const dataFim = document.getElementById('movDataFim')?.value;
            const produtoId = document.getElementById('movProdutoFiltro')?.value;
            
            console.log('Filtros:', { dataInicio, dataFim, produtoId });
            
            // Chamar a função de filtro diretamente
            if (typeof carregarMovimentacoes === 'function') {
                if (!dataInicio && !dataFim && (!produtoId || produtoId === 'todos')) {
                    carregarMovimentacoes({});
                } else {
                    carregarMovimentacoes({ dataInicio, dataFim, produtoId });
                }
            } else {
                console.error('Função carregarMovimentacoes não encontrada!');
            }
        };
    } else {
        console.error('❌ Botão filtrarMovimentacoesBtn NÃO encontrado!');
    }
    
    // Configurar botão Limpar Filtros (se existir)
    const limparBtn = document.getElementById('limparFiltrosBtn');
    if (limparBtn) {
        console.log('✅ Botão Limpar Filtros encontrado!');
        limparBtn.onclick = function(e) {
            e.preventDefault();
            console.log('👉 Botão Limpar Filtros CLICADO!');
            
            const dataInicioInput = document.getElementById('movDataInicio');
            const dataFimInput = document.getElementById('movDataFim');
            const produtoSelect = document.getElementById('movProdutoFiltro');
            
            if (dataInicioInput) dataInicioInput.value = '';
            if (dataFimInput) dataFimInput.value = '';
            if (produtoSelect) produtoSelect.value = 'todos';
            
            if (typeof carregarMovimentacoes === 'function') {
                carregarMovimentacoes({});
            }
            
            if (typeof mostrarNotificacao === 'function') {
                mostrarNotificacao('Filtros limpos!', 'info');
            }
        };
    }
    
    // Configurar botão Nova Contagem (inventário)
    const novaContagemBtn = document.getElementById('novaContagemBtn');
    const formContagem = document.getElementById('formContagem');
    if (novaContagemBtn && formContagem) {
        console.log('✅ Botão Nova Contagem encontrado!');
        novaContagemBtn.onclick = function(e) {
            e.preventDefault();
            console.log('👉 Botão Nova Contagem CLICADO!');
            formContagem.style.display = 'block';
            
            // Popular select de produtos
            const selectProduto = document.getElementById('contagemProduto');
            if (selectProduto && typeof produtos !== 'undefined' && produtos.length > 0) {
                selectProduto.innerHTML = '<option value="">-- Selecione um produto --</option>';
                produtos.forEach(produto => {
                    selectProduto.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome} (Estoque: ${(produto.estoqueAtual || 0).toFixed(3)} ${produto.unidade || 'UN'})</option>`;
                });
            }
        };
    }
    
    console.log('🔧 Configuração forçada concluída!');
});

// Também configurar quando a aba de movimentações for aberta
if (typeof mostrarAba === 'function') {
    const originalMostrarAba = mostrarAba;
    window.mostrarAba = function(aba) {
        originalMostrarAba(aba);
        if (aba === 'movimentacoes') {
            console.log('📊 Aba Movimentações aberta, recarregando dados...');
            if (typeof carregarMovimentacoes === 'function') {
                carregarMovimentacoes({});
            }
        }
    };
}
    
    // Expor funções globalmente para debug
    window.carregarQtdTeste = carregarQuantidadeSistemaTeste;
    window.calcularDiffTeste = calcularDiferencaTeste;
    window.popularSelectTeste = popularSelectProdutos;
    
    console.log('=== TESTE CONFIGURADO ===');
    console.log('Clique em "Nova Contagem" e selecione um produto!');
});

// ========== CONFIGURAÇÃO MANUAL DOS BOTÕES ==========
// Este código será executado quando o script carregar

console.log('🔧 Configurando botões do estoque...');

// Aguardar um pequeno delay para garantir que o DOM está pronto
setTimeout(function() {
    console.log('🔧 Configurando botões (após delay)...');
    
    // 1. Botão Filtrar Movimentações
    const filtrarBtn = document.getElementById('filtrarMovimentacoesBtn');
    if (filtrarBtn) {
        console.log('✅ Botão Filtrar encontrado!');
        filtrarBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Filtrar CLICADO!');
            
            const dataInicio = document.getElementById('movDataInicio')?.value || '';
            const dataFim = document.getElementById('movDataFim')?.value || '';
            const produtoId = document.getElementById('movProdutoFiltro')?.value || 'todos';
            
            console.log('📋 Filtros:', { dataInicio, dataFim, produtoId });
            
            // Chamar a função de carregar movimentações com filtros
            if (typeof carregarMovimentacoes === 'function') {
                carregarMovimentacoes({ dataInicio, dataFim, produtoId });
            } else {
                console.error('Função carregarMovimentacoes não encontrada!');
            }
        };
    } else {
        console.error('❌ Botão Filtrar NÃO encontrado!');
    }
    
    // 2. Botão Limpar Filtros (se existir)
    const limparBtn = document.getElementById('limparFiltrosBtn');
    if (limparBtn) {
        console.log('✅ Botão Limpar Filtros encontrado!');
        limparBtn.onclick = function(e) {
            e.preventDefault();
            console.log('👉 Botão Limpar Filtros CLICADO!');
            
            const dataInicio = document.getElementById('movDataInicio');
            const dataFim = document.getElementById('movDataFim');
            const produtoSelect = document.getElementById('movProdutoFiltro');
            
            if (dataInicio) dataInicio.value = '';
            if (dataFim) dataFim.value = '';
            if (produtoSelect) produtoSelect.value = 'todos';
            
            if (typeof carregarMovimentacoes === 'function') {
                carregarMovimentacoes({});
            }
            
            if (typeof mostrarNotificacao === 'function') {
                mostrarNotificacao('Filtros limpos!', 'info');
            }
        };
    }
    
    // 3. Botão Nova Contagem (Inventário)
    const novaContagemBtn = document.getElementById('novaContagemBtn');
    const formContagem = document.getElementById('formContagem');
    if (novaContagemBtn && formContagem) {
        console.log('✅ Botão Nova Contagem encontrado!');
        novaContagemBtn.onclick = function(e) {
            e.preventDefault();
            console.log('👉 Botão Nova Contagem CLICADO!');
            formContagem.style.display = 'block';
            
            // Popular select de produtos
            const selectProduto = document.getElementById('contagemProduto');
            if (selectProduto) {
                // Tentar acessar produtos de onde estiverem
                let produtosLista = null;
                if (typeof produtos !== 'undefined') produtosLista = produtos;
                else if (window.produtos) produtosLista = window.produtos;
                else if (typeof window.produtos !== 'undefined') produtosLista = window.produtos;
                
                if (produtosLista && produtosLista.length > 0) {
                    selectProduto.innerHTML = '<option value="">-- Selecione um produto --</option>';
                    produtosLista.forEach(produto => {
                        const estoqueAtual = (produto.estoqueAtual || 0).toFixed(3);
                        selectProduto.innerHTML += `<option value="${produto.id}">${produto.codigo || produto.id} - ${produto.nome} (Estoque: ${estoqueAtual} ${produto.unidade || 'UN'})</option>`;
                    });
                    console.log('✅ Select de produtos populado');
                } else {
                    console.log('⏳ Aguardando produtos carregarem...');
                    // Tentar novamente após 1 segundo
                    setTimeout(function() {
                        if (typeof produtos !== 'undefined' && produtos.length > 0) {
                            selectProduto.innerHTML = '<option value="">-- Selecione um produto --</option>';
                            produtos.forEach(produto => {
                                selectProduto.innerHTML += `<option value="${produto.id}">${produto.nome}</option>`;
                            });
                        }
                    }, 1000);
                }
            }
        };
    }
    
    console.log('🔧 Configuração dos botões concluída!');
}, 500);

// ========== FUNÇÕES DE ADMINISTRAÇÃO (VIA CONSOLE) ==========
// Estas funções só podem ser executadas pelo Console do navegador

window.admin = {
    // Listar todas as movimentações
    listarMovimentacoes: async function() {
        if (typeof db === 'undefined') {
            console.log('❌ Firebase não disponível');
            return;
        }
        const snapshot = await db.collection('movimentacoes').get();
        const lista = [];
        snapshot.forEach(doc => {
            lista.push({ 
                id: doc.id, 
                data: doc.data().dataHora,
                produto: doc.data().produtoNome || doc.data().produtoId,
                tipo: doc.data().tipo,
                quantidade: doc.data().quantidade,
                motivo: doc.data().motivo
            });
        });
        console.table(lista);
        return lista;
    },
    
    // Excluir movimentação específica (por ID)
    excluirMovimentacao: async function(id) {
        if (typeof db === 'undefined') {
            console.log('❌ Firebase não disponível');
            return;
        }
        if (!id) {
            console.log('❌ Informe o ID da movimentação');
            console.log('Use: admin.excluirMovimentacao("ID_AQUI")');
            return;
        }
        try {
            await db.collection('movimentacoes').doc(id).delete();
            console.log(`✅ Movimentação ${id} excluída com sucesso!`);
            // Recarregar a lista
            await carregarMovimentacoes({});
        } catch (error) {
            console.error('❌ Erro ao excluir:', error);
        }
    },
    
    // Excluir todas as movimentações de teste (apenas ajuste_manual)
    limparMovimentacoesTeste: async function() {
        if (typeof db === 'undefined') {
            console.log('❌ Firebase não disponível');
            return;
        }
        const confirmar = confirm('⚠️ ATENÇÃO! Isso irá excluir TODAS as movimentações de teste (motivo: ajuste_manual).\n\nDeseja continuar?');
        if (!confirmar) return;
        
        const snapshot = await db.collection('movimentacoes').where('motivo', '==', 'ajuste_manual').get();
        let count = 0;
        for (const doc of snapshot.docs) {
            await doc.ref.delete();
            count++;
        }
        console.log(`✅ ${count} movimentações de teste excluídas!`);
        await carregarMovimentacoes({});
    },
    
    // Excluir movimentações por período
    excluirPorPeriodo: async function(dataInicio, dataFim) {
        if (typeof db === 'undefined') {
            console.log('❌ Firebase não disponível');
            return;
        }
        const inicio = new Date(dataInicio);
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59);
        
        const snapshot = await db.collection('movimentacoes').get();
        let count = 0;
        for (const doc of snapshot.docs) {
            const dataMov = new Date(doc.data().dataHora);
            if (dataMov >= inicio && dataMov <= fim) {
                await doc.ref.delete();
                count++;
            }
        }
        console.log(`✅ ${count} movimentações excluídas no período ${dataInicio} a ${dataFim}`);
        await carregarMovimentacoes({});
    }
};

console.log('🛠️ Funções admin disponíveis no Console!');
console.log('📋 Comandos disponíveis:');
console.log('   admin.listarMovimentacoes() - Lista todas as movimentações');
console.log('   admin.excluirMovimentacao("ID") - Exclui movimentação específica');
console.log('   admin.limparMovimentacoesTeste() - Exclui movimentações de teste');
console.log('   admin.excluirPorPeriodo("2024-01-01", "2024-01-31") - Exclui por período');