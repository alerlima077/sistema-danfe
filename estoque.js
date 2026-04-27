// ========== VARIÁVEIS GLOBAIS ==========
let produtos = [];
let movimentacoes = [];
let inventarios = [];

// ========== FUNÇÕES PARA EVITAR DUPLICIDADE ==========

// Normalizar texto para comparação (remove acentos, espaços extras, converte para maiúsculo)
function normalizarTexto(texto) {
    if (!texto) return '';
    
    // Converter para maiúsculo
    let normalizado = texto.toUpperCase().trim();
    
    // Remover acentos
    normalizado = normalizado.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Remover pontuações e caracteres especiais (exceto números e letras)
    normalizado = normalizado.replace(/[^\w\s]/g, '');
    
    // Remover espaços extras
    normalizado = normalizado.replace(/\s+/g, ' ');
    
    // Remover palavras comuns que podem causar duplicidade
    const palavrasRemover = ['KG', 'UN', 'CX', 'PCT', 'G', 'L', 'ML', 'PC', 'FD'];
    palavrasRemover.forEach(palavra => {
        normalizado = normalizado.replace(new RegExp(`\\b${palavra}\\b`, 'g'), '');
    });
    
    // Remover números no final (ex: "CALABRESA 12KG" -> "CALABRESA")
    normalizado = normalizado.replace(/\s+\d+$/, '');
    normalizado = normalizado.replace(/\d+$/, '');
    
    return normalizado.trim();
}

// Buscar produtos similares
async function buscarProdutosSimilares(nomeProduto, codigoProduto = null) {
    if (typeof produtos === 'undefined' || produtos.length === 0) return [];
    
    const nomeNormalizado = normalizarTexto(nomeProduto);
    const similares = [];
    
    produtos.forEach(produto => {
        const produtoNormalizado = normalizarTexto(produto.nome);
        
        // Verificar se o código já existe
        if (codigoProduto && produto.codigo === codigoProduto) {
            similares.push({ produto, tipo: 'codigo', confianca: 100 });
        }
        // Verificar nome idêntico
        else if (produtoNormalizado === nomeNormalizado) {
            similares.push({ produto, tipo: 'nome', confianca: 95 });
        }
        // Verificar se o nome está contido
        else if (produtoNormalizado.includes(nomeNormalizado) || nomeNormalizado.includes(produtoNormalizado)) {
            similares.push({ produto, tipo: 'parcial', confianca: 70 });
        }
        // Verificar palavras-chave
        else {
            const palavrasNome = nomeNormalizado.split(' ');
            const palavrasProduto = produtoNormalizado.split(' ');
            const palavrasComuns = palavrasNome.filter(p => palavrasProduto.includes(p));
            
            if (palavrasComuns.length >= 1 && palavrasComuns.length <= 2) {
                similares.push({ produto, tipo: 'palavra', confianca: 50 });
            }
        }
    });
    
    similares.sort((a, b) => b.confianca - a.confianca);
    return similares;
}

// Verificar duplicidade antes de cadastrar
async function verificarDuplicidadeProduto(nome, codigo) {
    const similares = await buscarProdutosSimilares(nome, codigo);
    const fortesSuspeitas = similares.filter(s => s.confianca >= 70);
    
    if (fortesSuspeitas.length > 0) {
        const produtoExistente = fortesSuspeitas[0].produto;
        
        return {
            duplicado: true,
            produtoExistente: produtoExistente,
            similares: fortesSuspeitas,
            mensagem: `⚠️ ATENÇÃO! Já existe um produto similar cadastrado:\n\n` +
                      `📦 Produto: ${produtoExistente.nome}\n` +
                      `📝 Código: ${produtoExistente.codigo}\n` +
                      `📊 Estoque: ${produtoExistente.estoqueAtual || 0} ${produtoExistente.unidade}\n\n` +
                      `Deseja continuar com o cadastro mesmo assim?`
        };
    }
    
    return { duplicado: false };
}

// ========== FUNÇÕES DAS ABAS ==========

function mostrarAba(aba) {
    console.log('📑 Abrindo aba:', aba);
    
    // Esconder todas as abas
    const abasIds = ['abaProdutos', 'abaMovimentacoes', 'abaInventario', 'abaConsumo', 'abaRelatorios'];
    abasIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // Mostrar a aba selecionada
    const abaId = 'aba' + aba.charAt(0).toUpperCase() + aba.slice(1);
    const abaElement = document.getElementById(abaId);
    if (abaElement) {
        abaElement.style.display = 'block';
        console.log('✅ Aba', aba, 'aberta');
    } else {
        console.error('❌ Aba não encontrada:', abaId);
    }
    
    // Atualizar botões ativos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${aba}'`)) {
            btn.classList.add('active');
        }
    });
}

// Expor globalmente
window.mostrarAba = mostrarAba;

// ========== FUNÇÕES DO FIREBASE PARA PRODUTOS ==========

async function carregarProdutos() {
    console.log('🔄 Carregando produtos...');
    if (typeof db === 'undefined') return;
    
    try {
        const snapshot = await db.collection('produtos').orderBy('nome', 'asc').get();
        produtos = [];
        snapshot.forEach(doc => {
            produtos.push({ id: doc.id, ...doc.data() });
        });
        console.log(`✅ ${produtos.length} produtos carregados`);
        
        // ⭐ RENDERIZAR APÓS CARREGAR ⭐
        if (typeof renderizarProdutosComFiltro === 'function') {
            renderizarProdutosComFiltro();
        } else if (typeof renderizarProdutos === 'function') {
            renderizarProdutos();
        }
        
        atualizarSelectsProdutos();
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
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

// ========== FUNÇÃO PARA GERAR CÓDIGO AUTOMÁTICO ==========
async function gerarProximoCodigo() {
    if (typeof db === 'undefined') return '001';
    
    try {
        // Buscar todos os produtos ordenados por código decrescente
        const snapshot = await db.collection('produtos')
            .orderBy('codigo', 'desc')
            .limit(1)
            .get();
        
        let ultimoCodigo = 0;
        
        if (!snapshot.empty) {
            const ultimoProduto = snapshot.docs[0].data();
            const codigoStr = ultimoProduto.codigo;
            
            // Extrair número do código (ex: "001" -> 1, "045" -> 45, "0001" -> 1)
            const numero = parseInt(codigoStr, 10);
            if (!isNaN(numero)) {
                ultimoCodigo = numero;
            }
        }
        
        const proximoCodigo = ultimoCodigo + 1;
        
        // Definir formato com 3 dígitos (001, 002, 003...)
        // Se quiser 4 dígitos, mude para '0000'
        const formato = '000';
        const codigoFormatado = proximoCodigo.toString().padStart(formato.length, '0');
        
        console.log(`📝 Novo código gerado: ${codigoFormatado} (anterior: ${ultimoCodigo})`);
        return codigoFormatado;
        
    } catch (error) {
        console.error('Erro ao gerar código:', error);
        return '001';
    }
}

// Função para atualizar o campo de código no formulário
async function atualizarCampoCodigo() {
    const campoCodigo = document.getElementById('produtoCodigo');
    if (campoCodigo) {
        const novoCodigo = await gerarProximoCodigo();
        campoCodigo.value = novoCodigo;
    }
}

// Chamar a atualização quando a página de estoque for aberta
function inicializarCodigoAutomatico() {
    atualizarCampoCodigo();
}

// Chamar após cadastrar um produto (para gerar o próximo código)
async function aposCadastrarProduto() {
    await atualizarCampoCodigo();
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
    const precoCusto = converterParaNumero(document.getElementById('edit_precoCusto').value);
    const precoVenda = converterParaNumero(document.getElementById('produtoPrecoVenda').value);
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

// ========== FUNÇÕES DAS ABAS ==========

function mostrarAba(aba) {
    console.log('📑 Abrindo aba:', aba);
    
    // Esconder todas as abas
    const abas = ['Produtos', 'Movimentacoes', 'Inventario', 'Consumo', 'Relatorios'];
    abas.forEach(nome => {
        const element = document.getElementById(`aba${nome}`);
        if (element) element.style.display = 'none';
    });
    
    // Mostrar a aba selecionada
    const abaSelecionada = document.getElementById(`aba${aba.charAt(0).toUpperCase() + aba.slice(1)}`);
    if (abaSelecionada) {
        abaSelecionada.style.display = 'block';
        console.log(`✅ Aba ${aba} aberta`);
    } else {
        console.error(`❌ Aba ${aba} não encontrada`);
    }
    
    // Atualizar botões ativos
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        // Verificar se o onclick chama a aba correta
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${aba}'`)) {
            btn.classList.add('active');
        }
    });
    
    // Recarregar dados específicos da aba
    if (aba === 'movimentacoes' && typeof carregarMovimentacoes === 'function') {
        carregarMovimentacoes({});
    }
    if (aba === 'inventario' && typeof carregarInventarios === 'function') {
        carregarInventarios();
    }
    if (aba === 'consumo' && typeof carregarConsumo === 'function') {
        carregarConsumo();
    }
}

// Expor função globalmente
window.mostrarAba = mostrarAba;

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

// Carregar movimentações do Firebase - VERSÃO CORRIGIDA (FUSO HORÁRIO)
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
        
        // Aplicar filtros
        let movimentacoesFiltradas = [...todasMovimentacoes];
        
        // ⭐ CORREÇÃO DO FUSO HORÁRIO ⭐
        // Filtrar por data de início
        if (filtros.dataInicio && filtros.dataInicio !== '') {
            // Criar data no fuso local (Brasil)
            const [ano, mes, dia] = filtros.dataInicio.split('-');
            const dataInicioLocal = new Date(ano, mes - 1, dia, 0, 0, 0);
            
            movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => {
                const dataMov = new Date(mov.dataHora);
                return dataMov >= dataInicioLocal;
            });
            console.log(`📅 Filtro data início (${filtros.dataInicio}): ${movimentacoesFiltradas.length} movimentações`);
        }
        
        // Filtrar por data de fim
        if (filtros.dataFim && filtros.dataFim !== '') {
            const [ano, mes, dia] = filtros.dataFim.split('-');
            // Ir até o final do dia (23:59:59)
            const dataFimLocal = new Date(ano, mes - 1, dia, 23, 59, 59);
            
            movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => {
                const dataMov = new Date(mov.dataHora);
                return dataMov <= dataFimLocal;
            });
            console.log(`📅 Filtro data fim (${filtros.dataFim}): ${movimentacoesFiltradas.length} movimentações`);
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
    const quantidadeContada = converterParaNumero(document.getElementById('quantidadeContada').value);
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

// ========== FUNÇÕES DE BUSCA DE PRODUTOS ==========

let produtosFiltrados = [];

// Filtrar produtos baseado na busca
function filtrarProdutos(termo) {
    if (!termo || termo.trim() === '') {
        produtosFiltrados = [...produtos];
        return produtosFiltrados;
    }
    
    const termoLower = termo.toLowerCase().trim();
    
    produtosFiltrados = produtos.filter(produto => {
        return produto.codigo?.toLowerCase().includes(termoLower) ||
               produto.nome?.toLowerCase().includes(termoLower) ||
               produto.categoria?.toLowerCase().includes(termoLower);
    });
    
    return produtosFiltrados;
}

// Renderizar lista de produtos com filtro
function renderizarProdutosComFiltro() {
    const tbody = document.getElementById('produtosTableBody');
    if (!tbody) return;
    
    const termoBusca = document.getElementById('buscaProduto')?.value || '';
    const produtosParaMostrar = termoBusca ? filtrarProdutos(termoBusca) : produtos;
    
    if (produtosParaMostrar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-message">
            ${termoBusca ? '🔍 Nenhum produto encontrado com "' + termoBusca + '"' : 'Nenhum produto cadastrado'}
         </td></tr>`;
        return;
    }
    
    tbody.innerHTML = produtosParaMostrar.map(produto => {
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
        
        const estoqueFormatado = estoqueAtual.toFixed(2);
        const custoFormatado = formatarValorBrasileiro(produto.precoCusto || 0);
        const minimoFormatado = estoqueMinimo.toFixed(2);
        
        return `
            <tr>
                <td>${produto.codigo || '-'}</td>
                <td><strong>${produto.nome}</strong><br><small>${produto.categoria || '-'}</small></td>
                <td class="${estoqueClass}">
                    <strong>${estoqueFormatado} ${produto.unidade || 'UN'}</strong>
                    ${alertaTexto ? `<br><small>⚠️ ${alertaTexto}</small>` : ''}
                    ${estoqueMinimo > 0 ? `<br><small style="color: #666;">Mín: ${minimoFormatado} ${produto.unidade || 'UN'}</small>` : ''}
                 </td>
                <td>R$ ${custoFormatado}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editarProduto('${produto.id}')">✏️ Editar</button>
                        <button class="btn-delete" onclick="excluirProduto('${produto.id}')">🗑️ Excluir</button>
                        <button class="btn-primary" style="background: #8b5cf6;" onclick="ajustarEstoque('${produto.id}')">📦 Estoque</button>
                    </div>
                 </td>
             </tr>
        `;
    }).join('');
}

// Mostrar sugestões de busca
function mostrarSugestoesBusca() {
    const termo = document.getElementById('buscaProduto')?.value || '';
    const sugestoesDiv = document.getElementById('sugestoesBusca');
    
    if (!termo || termo.length < 2) {
        sugestoesDiv.style.display = 'none';
        return;
    }
    
    const produtosFiltrados = filtrarProdutos(termo);
    
    if (produtosFiltrados.length === 0) {
        sugestoesDiv.style.display = 'none';
        return;
    }
    
    const sugestoes = produtosFiltrados.slice(0, 5);
    
    sugestoesDiv.innerHTML = sugestoes.map(produto => {
        const nomeDestacado = produto.nome.replace(new RegExp(`(${termo})`, 'gi'), '<span class="highlight">$1</span>');
        
        return `
            <div class="sugestao-item" onclick="selecionarProdutoBusca('${produto.id}')">
                <div>
                    <span class="sugestao-nome">${nomeDestacado}</span>
                    <span class="sugestao-codigo">(${produto.codigo})</span>
                </div>
                <div class="sugestao-estoque">📦 Estoque: ${(produto.estoqueAtual || 0).toFixed(3)} ${produto.unidade || 'UN'}</div>
            </div>
        `;
    }).join('');
    
    sugestoesDiv.style.display = 'block';
}

// Selecionar produto da busca
function selecionarProdutoBusca(produtoId) {
    document.getElementById('buscaProduto').value = '';
    document.getElementById('sugestoesBusca').style.display = 'none';
    document.getElementById('limparBuscaBtn').style.display = 'none';
    
    const produto = produtos.find(p => p.id === produtoId);
    if (produto) {
        document.getElementById('buscaProduto').value = produto.nome;
        renderizarProdutosComFiltro();
        
        setTimeout(() => {
            const rows = document.querySelectorAll('#produtosTableBody tr');
            for (let row of rows) {
                if (row.innerText.includes(produto.nome)) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.style.backgroundColor = '#fef08a';
                    setTimeout(() => {
                        row.style.backgroundColor = '';
                    }, 2000);
                    break;
                }
            }
        }, 100);
    }
}

// Limpar busca
function limparBusca() {
    document.getElementById('buscaProduto').value = '';
    document.getElementById('sugestoesBusca').style.display = 'none';
    document.getElementById('limparBuscaBtn').style.display = 'none';
    renderizarProdutosComFiltro();
}

// Configurar event listeners da busca
function configurarBuscaProdutos() {
    const buscaInput = document.getElementById('buscaProduto');
    const limparBtn = document.getElementById('limparBuscaBtn');
    
    if (buscaInput) {
        buscaInput.addEventListener('input', function() {
            const termo = this.value;
            if (termo.length > 0) {
                limparBtn.style.display = 'block';
                mostrarSugestoesBusca();
            } else {
                limparBtn.style.display = 'none';
                document.getElementById('sugestoesBusca').style.display = 'none';
            }
            renderizarProdutosComFiltro();
        });
        
        buscaInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                limparBusca();
            }
        });
    }
    
    if (limparBtn) {
        limparBtn.addEventListener('click', limparBusca);
    }
    
    document.addEventListener('click', function(e) {
        const sugestoes = document.getElementById('sugestoesBusca');
        const buscaInput = document.getElementById('buscaProduto');
        if (sugestoes && buscaInput && !buscaInput.contains(e.target) && !sugestoes.contains(e.target)) {
            sugestoes.style.display = 'none';
        }
    });
}

function renderizarProdutos() {
    const tbody = document.getElementById('produtosTableBody');
    if (!tbody) return;
    
    if (typeof produtos === 'undefined' || produtos.length === 0) {
        tbody.innerHTML = '</td><td colspan="5" class="empty-message">Nenhum produto cadastrado</td></tr>';
        return;
    }
    
    // ⭐ PEGAR O TERMO DE BUSCA DO CAMPO ⭐
    const buscaInput = document.getElementById('buscaProduto');
    const termoBusca = buscaInput ? buscaInput.value.trim().toLowerCase() : '';
    
    // ⭐ FILTRAR PRODUTOS PELO TERMO DE BUSCA ⭐
    let produtosFiltrados = produtos;
    if (termoBusca !== '') {
        produtosFiltrados = produtos.filter(produto => {
            return (produto.codigo && produto.codigo.toLowerCase().includes(termoBusca)) ||
                   (produto.nome && produto.nome.toLowerCase().includes(termoBusca));
        });
        console.log(`🔍 Busca por "${termoBusca}": ${produtosFiltrados.length} produtos encontrados`);
    }
    
    // ⭐ MOSTRAR MENSAGEM SE NENHUM PRODUTO FOR ENCONTRADO ⭐
    if (produtosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-message">🔍 Nenhum produto encontrado com "${termoBusca}"</td></tr>`;
        return;
    }
    
    tbody.innerHTML = produtosFiltrados.map(produto => {
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
        
        // Usar as funções de formatação brasileira
        const estoqueFormatado = estoqueAtual.toFixed(2);
        const custoFormatado = formatarValorBrasileiro(produto.precoCusto || 0);
        const minimoFormatado = estoqueMinimo.toFixed(2);
        
        // ⭐ DESTACAR O TERMO BUSCADO NO NOME (opcional) ⭐
        let nomeExibido = produto.nome;
        if (termoBusca) {
            const regex = new RegExp(`(${termoBusca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            nomeExibido = produto.nome.replace(regex, '<span class="highlight">$1</span>');
        }
        
        return `
            <tr>
                <td>${produto.codigo || '-'}</td>
                <td><strong>${nomeExibido}</strong><br><small>${produto.categoria || '-'}</small></td>
                <td class="${estoqueClass}">
                    <strong>${estoqueFormatado} ${produto.unidade || 'UN'}</strong>
                    ${alertaTexto ? `<br><small>⚠️ ${alertaTexto}</small>` : ''}
                    ${estoqueMinimo > 0 ? `<br><small style="color: #666;">Mín: ${minimoFormatado} ${produto.unidade || 'UN'}</small>` : ''}
                </td>
                <td>R$ ${custoFormatado}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editarProduto('${produto.id}')">✏️ Editar</button>
                        <button class="btn-delete" onclick="excluirProduto('${produto.id}')">🗑️ Excluir</button>
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

// ========== CADASTRO DE PRODUTO - COM VERIFICAÇÃO DE DUPLICIDADE ==========

// Aguardar o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando cadastro de produto...');
    
    // ⭐ CONFIGURAR AUTOCOMPLETE/SUGESTÃO AO DIGITAR ⭐
    const inputNome = document.getElementById('produtoNome');
    let timeoutId;
    
    if (inputNome) {
        inputNome.addEventListener('input', async function() {
            clearTimeout(timeoutId);
            const termo = this.value.trim();
            
            if (termo.length < 3) return;
            
            timeoutId = setTimeout(async () => {
                // Aguardar produtos carregados
                if (typeof produtos === 'undefined' || produtos.length === 0) {
                    await carregarProdutos();
                }
                
                const similares = await buscarProdutosSimilares(termo);
                if (similares.length > 0) {
                    const sugestoes = similares.slice(0, 3).map(s => s.produto.nome).join(', ');
                    mostrarNotificacao(`💡 Produto similar encontrado: ${sugestoes}`, 'info');
                }
            }, 800);
        });
    }
    
    // Tentar encontrar o botão várias vezes
    let tentativas = 0;
    const interval = setInterval(function() {
        const btnSalvar = document.getElementById('salvarProdutoBtn');
        if (btnSalvar) {
            clearInterval(interval);
            console.log('✅ Botão salvarProdutoBtn encontrado!');
            
            // Remover event listeners antigos
            const novoBtn = btnSalvar.cloneNode(true);
            btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);
            
            novoBtn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('👉 Botão CADASTRAR PRODUTO clicado!');
                
                // Coletar dados
                const codigo = document.getElementById('produtoCodigo')?.value;
                const nome = document.getElementById('produtoNome')?.value;
                const categoria = document.getElementById('produtoCategoria')?.value;
                const unidade = document.getElementById('produtoUnidade')?.value;
                const precoCusto = converterParaNumero(document.getElementById('produtoPrecoCusto')?.value);
                const estoqueMinimo = converterParaNumero(document.getElementById('produtoEstoqueMinimo')?.value);
                
                console.log('Dados coletados:', { codigo, nome, categoria, unidade, precoCusto, estoqueMinimo });
                
                // Validações
                if (!codigo) {
                    alert('❌ Preencha o código do produto!');
                    return;
                }
                if (!nome) {
                    alert('❌ Preencha o nome do produto!');
                    return;
                }
                
                // ⭐ VERIFICAR DUPLICIDADE ANTES DE CADASTRAR ⭐
                if (typeof produtos !== 'undefined' && produtos.length > 0) {
                    const duplicidade = await verificarDuplicidadeProduto(nome, codigo);
                    
                    if (duplicidade.duplicado) {
                        const confirmar = confirm(duplicidade.mensagem);
                        if (!confirmar) {
                            mostrarNotificacao('Cadastro cancelado para evitar duplicidade.', 'warning');
                            return;
                        }
                        mostrarNotificacao('Cadastro continuado mesmo com produto similar.', 'info');
                    }
                }
                
                const produto = {
                    codigo: codigo.toUpperCase(),
                    nome: nome.toUpperCase(),
                    categoria: categoria,
                    unidade: unidade,
                    precoCusto: precoCusto,
                    estoqueAtual: 0,
                    estoqueMinimo: estoqueMinimo,
                    nomeNormalizado: normalizarTexto(nome),
                    createdAt: new Date().toISOString()
                };
                
                console.log('Produto a salvar:', produto);
                
                try {
                    // Salvar no Firebase
                    if (typeof db !== 'undefined') {
                        const docRef = await db.collection('produtos').add(produto);
                        console.log('✅ Produto salvo com ID:', docRef.id);
                    } else {
                        console.log('Firebase não disponível');
                        if (typeof produtos !== 'undefined') {
                            produtos.push(produto);
                        }
                    }
                    
                    // Recarregar lista
                    if (typeof carregarProdutos === 'function') {
                        await carregarProdutos();
                    }
                    
                    // Limpar formulário
                    const form = document.getElementById('produtoForm');
                    if (form) form.reset();
                    
                    // Atualizar campo de preço para 0,00
                    const precoInput = document.getElementById('produtoPrecoCusto');
                    if (precoInput) precoInput.value = '0,00';
                    
                    // Atualizar campo de estoque mínimo
                    const minInput = document.getElementById('produtoEstoqueMinimo');
                    if (minInput) minInput.value = '0,000';
                    
                    alert('✅ Produto cadastrado com sucesso!');
                    mostrarNotificacao('Produto cadastrado com sucesso!', 'success');
                    
                    // Atualizar Dashboard se estiver visível
                    if (document.getElementById('dashboardPage')?.style.display === 'block') {
                        if (typeof carregarDashboard === 'function') {
                            await carregarDashboard();
                        }
                    }
                    
                } catch (error) {
                    console.error('❌ Erro ao cadastrar produto:', error);
                    alert('❌ Erro ao cadastrar produto! Verifique o console.');
                    mostrarNotificacao('Erro ao cadastrar produto!', 'error');
                }
            });
        }
        
        tentativas++;
        if (tentativas > 20) {
            clearInterval(interval);
            console.log('❌ Botão salvarProdutoBtn não encontrado após 20 tentativas');
        }
    }, 500);
});

// Editar produto - VERSÃO CORRIGIDA
window.editarProduto = async function(produtoId) {
    console.log('✏️ Editando produto:', produtoId);
    
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
    
    // Preencher o formulário
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
                </select>
            </div>
            <div class="form-group">
                <label>Preço de Custo (R$)</label>
                <input type="text" id="edit_precoCusto" class="input-valor" value="${formatarValorBrasileiro(produto.precoCusto || 0)}" style="text-align: right;">
            </div>
            <div class="form-group">
                <label>Estoque Atual</label>
                <input type="text" id="edit_estoqueAtual" class="input-quantidade" value="${(produto.estoqueAtual || 0).toFixed(2)}" style="text-align: right;">
            </div>
            <div class="form-group">
                <label>Estoque Mínimo</label>
                <input type="text" id="edit_estoqueMinimo" class="input-quantidade" value="${(produto.estoqueMinimo || 0).toFixed(2)}" style="text-align: right;">
            </div>
            <div class="modal-buttons">
                <button type="submit" class="btn-save" id="btnSalvarEdicao">💾 Salvar</button>
                <button type="button" class="btn-cancel" onclick="fecharModal('editarProdutoModal')">Cancelar</button>
            </div>
        </form>
    `;
    
    modal.style.display = 'flex';
    
    // Configurar o botão salvar
    const btnSalvar = document.getElementById('btnSalvarEdicao');
    if (btnSalvar) {
        // Remover event listeners antigos
        const novoBtn = btnSalvar.cloneNode(true);
        btnSalvar.parentNode.replaceChild(novoBtn, btnSalvar);
        
        novoBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('👉 Botão SALVAR clicado!');
            
            // Coletar dados
            const precoCusto = converterParaNumero(document.getElementById('edit_precoCusto').value);
            const estoqueAtual = converterParaNumero(document.getElementById('edit_estoqueAtual').value);
            const estoqueMinimo = converterParaNumero(document.getElementById('edit_estoqueMinimo').value);
            
            const dados = {
                codigo: document.getElementById('edit_codigo').value.toUpperCase(),
                nome: document.getElementById('edit_nome').value.toUpperCase(),
                categoria: document.getElementById('edit_categoria').value,
                unidade: document.getElementById('edit_unidade').value,
                precoCusto: precoCusto,
                estoqueAtual: estoqueAtual,
                estoqueMinimo: estoqueMinimo,
                updatedAt: new Date().toISOString()
            };
            
            console.log('Dados para salvar:', dados);
            
            try {
                await atualizarProdutoFirebase(produto.id, dados);
                await carregarProdutos();
                fecharModal('editarProdutoModal');
                mostrarNotificacao('Produto atualizado com sucesso!', 'success');
                
                // Atualizar Dashboard se estiver visível
                if (document.getElementById('dashboardPage')?.style.display === 'block') {
                    if (typeof carregarDashboard === 'function') {
                        await carregarDashboard();
                    }
                }
            } catch (error) {
                console.error('Erro ao atualizar:', error);
                mostrarNotificacao('Erro ao atualizar produto!', 'error');
            }
        });
    }
};

// Excluir produto
window.excluirProduto = async function(produtoId) {
    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
    if (confirm(`Excluir produto "${produto.nome}"?`)) {
        try {
            await excluirProdutoFirebase(produtoId);
            await carregarProdutos();
            
            // ⭐ ATUALIZAR DASHBOARD SE ESTIVER VISÍVEL ⭐
            if (document.getElementById('dashboardPage').style.display === 'block') {
                if (typeof carregarDashboard === 'function') {
                    await carregarDashboard();
                }
            }
            
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
        const quantidade = converterParaNumero(novaQuantidade);
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
    configurarInventarioListeners(); 
    configurarConsumoListeners();
    configurarRelatorioListeners();  // ⭐ NOVO // ⭐ NOVO: Configurar listeners do inventário
    configurarBuscaProdutos();
    configurarBuscaProdutosPermanente();
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

// ========== FUNÇÕES DA TELA DE CONSUMO ==========

// Variáveis da tela de consumo
if (typeof consumoData === 'undefined') {
    var consumoData = [];
}
let produtosConsumo = [];

// ========== CONFIGURAÇÃO DOS FILTROS DE CONSUMO ==========

// Mostrar/esconder campos de data personalizada
function toggleCamposDataPersonalizada() {
    const periodo = document.getElementById('periodoConsumo');
    const dataInicioGroup = document.getElementById('dataInicioGroup');
    const dataFimGroup = document.getElementById('dataFimGroup');
    
    console.log('Toggle datas - Período selecionado:', periodo?.value);
    
    if (periodo && dataInicioGroup && dataFimGroup) {
        if (periodo.value === 'personalizado') {
            dataInicioGroup.style.display = 'block';
            dataFimGroup.style.display = 'block';
            console.log('Campos de data personalizada visíveis');
        } else {
            dataInicioGroup.style.display = 'none';
            dataFimGroup.style.display = 'none';
            console.log('Campos de data personalizada ocultos');
        }
    } else {
        console.log('Elementos não encontrados');
    }
}

// Configurar event listeners da tela de consumo
function configurarConsumoListeners() {
    console.log('⚙️ Configurando listeners de consumo...');
    
    const periodoSelect = document.getElementById('periodoConsumo');
    if (periodoSelect) {
        periodoSelect.addEventListener('change', toggleCamposDataPersonalizada);
        console.log('✅ Listener do período configurado');
    }
    
    const filtrarBtn = document.getElementById('filtrarConsumoBtn');
    if (filtrarBtn) {
        // Remover listeners antigos
        const novoBtn = filtrarBtn.cloneNode(true);
        filtrarBtn.parentNode.replaceChild(novoBtn, filtrarBtn);
        
        novoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('👉 Botão Filtrar Consumo clicado!');
            if (typeof exibirConsumo === 'function') {
                exibirConsumo();
            } else {
                console.error('Função exibirConsumo não encontrada');
            }
        });
        console.log('✅ Botão Filtrar configurado');
    } else {
        console.log('❌ Botão filtrarConsumoBtn não encontrado');
    }
    
    // Inicializar toggle
    toggleCamposDataPersonalizada();
}

// Calcular período com base na seleção
function calcularPeriodo() {
    const periodo = document.getElementById('periodoConsumo').value;
    const hoje = new Date();
    let dataInicio, dataFim;
    
    dataFim = new Date(hoje);
    dataFim.setHours(23, 59, 59, 999);
    
    switch(periodo) {
        case 'diario':
            dataInicio = new Date(hoje);
            dataInicio.setHours(0, 0, 0, 0);
            break;
        case 'semanal':
            dataInicio = new Date(hoje);
            dataInicio.setDate(hoje.getDate() - 7);
            dataInicio.setHours(0, 0, 0, 0);
            break;
        case 'mensal':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataInicio.setHours(0, 0, 0, 0);
            break;
        case 'personalizado':
            const dataInicioStr = document.getElementById('dataInicioConsumo').value;
            const dataFimStr = document.getElementById('dataFimConsumo').value;
            dataInicio = new Date(dataInicioStr);
            dataFim = new Date(dataFimStr);
            dataFim.setHours(23, 59, 59, 999);
            break;
        default:
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    }
    
    return { dataInicio, dataFim };
}

// Carregar consumo
async function carregarConsumo() {
    console.log('🔄 Carregando dados de consumo...');
    
    if (typeof db === 'undefined') {
        console.log('Firebase não disponível');
        return;
    }
    
    try {
        // Buscar movimentações de saída
        const snapshot = await db.collection('movimentacoes')
            .where('tipo', '==', 'saida')
            .get();
        
        consumoData = [];
        snapshot.forEach(doc => {
            consumoData.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`📦 ${consumoData.length} movimentações de saída encontradas`);
        
        // Popular select de produtos
        popularSelectProdutosConsumo();
        
    } catch (error) {
        console.error('Erro ao carregar consumo:', error);
    }
}

// Popular select de produtos na tela de consumo
function popularSelectProdutosConsumo() {
    const select = document.getElementById('produtoConsumo');
    if (!select) return;
    
    select.innerHTML = '<option value="todos">-- Todos os produtos --</option>';
    
    // Usar produtos da lista global
    if (typeof produtos !== 'undefined' && produtos.length > 0) {
        produtos.forEach(produto => {
            select.innerHTML += `<option value="${produto.id}">${produto.codigo} - ${produto.nome}</option>`;
        });
    }
}

// Filtrar e exibir consumo - valores em quantidade
async function exibirConsumo() {
    console.log('🔍 Filtrando consumo...');
    
    const produtoId = document.getElementById('produtoConsumo').value;
    const periodo = document.getElementById('periodoConsumo').value;
    
    console.log('Período selecionado:', periodo);
    console.log('Produto ID:', produtoId);
    
    // Verificar se consumoData está vazio
    if (!consumoData || consumoData.length === 0) {
        console.log('Nenhum dado de consumo carregado. Recarregando...');
        await carregarConsumo();
    }
    
    // Calcular período com base na seleção
    let dataInicio, dataFim;
    const hoje = new Date();
    
    if (periodo === 'personalizado') {
        const inicioStr = document.getElementById('dataInicioConsumo').value;
        const fimStr = document.getElementById('dataFimConsumo').value;
        
        if (!inicioStr || !fimStr) {
            alert('Selecione as datas de início e fim!');
            return;
        }
        
        dataInicio = new Date(inicioStr);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(fimStr);
        dataFim.setHours(23, 59, 59, 999);
    } else if (periodo === 'diario') {
        dataInicio = new Date(hoje);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(hoje);
        dataFim.setHours(23, 59, 59, 999);
    } else if (periodo === 'semanal') {
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 7);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(hoje);
        dataFim.setHours(23, 59, 59, 999);
    } else {
        // Mensal
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        dataFim.setHours(23, 59, 59, 999);
    }
    
    console.log('Data Início:', dataInicio);
    console.log('Data Fim:', dataFim);
    
    // Filtrar movimentações por período e produto
    let movimentacoesFiltradas = [...consumoData];
    
    // Filtrar por período
    movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => {
        const dataMov = new Date(mov.dataHora);
        return dataMov >= dataInicio && dataMov <= dataFim;
    });
    
    // Filtrar por produto
    if (produtoId !== 'todos') {
        movimentacoesFiltradas = movimentacoesFiltradas.filter(mov => mov.produtoId === produtoId);
    }
    
    console.log(`${movimentacoesFiltradas.length} movimentações após filtros`);
    
    // Calcular totais em quantidade
    const quantidadeTotal = movimentacoesFiltradas.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    
    // Calcular média diária em quantidade
    const dias = Math.ceil((dataFim - dataInicio) / (1000 * 60 * 60 * 24)) || 1;
    const mediaDiaria = quantidadeTotal / dias;
    
    // Obter unidade do produto
    let unidade = 'unidades';
    let estoqueAtual = 0;
    
    if (produtoId !== 'todos' && typeof produtos !== 'undefined' && produtos.length > 0) {
        const produto = produtos.find(p => p.id === produtoId);
        if (produto) {
            estoqueAtual = produto.estoqueAtual || 0;
            unidade = produto.unidade || 'UN';
            console.log('Produto encontrado:', produto.nome, 'Unidade:', unidade);
        } else {
            console.log('Produto não encontrado!');
        }
    } else if (produtoId === 'todos' && typeof produtos !== 'undefined') {
        estoqueAtual = produtos.reduce((sum, p) => sum + (p.estoqueAtual || 0), 0);
        unidade = 'unidades';
    }
    
    // Atualizar cards (em quantidade)
    const estoqueElement = document.getElementById('estoqueAtualConsumo');
    const consumoElement = document.getElementById('consumoPeriodo');
    const totalElement = document.getElementById('valorConsumidoPeriodo');
    const mediaElement = document.getElementById('mediaDiaria');
    
    if (estoqueElement) estoqueElement.innerHTML = `${estoqueAtual.toFixed(2)} ${unidade}`;
    if (consumoElement) consumoElement.innerHTML = `${quantidadeTotal.toFixed(2)} ${unidade}`;
    if (totalElement) totalElement.innerHTML = `${quantidadeTotal.toFixed(2)} ${unidade}`;
    if (mediaElement) mediaElement.innerHTML = `${mediaDiaria.toFixed(2)} ${unidade}/dia`;
    
    console.log('Cards atualizados:', {
        estoque: `${estoqueAtual.toFixed(2)} ${unidade}`,
        consumo: `${quantidadeTotal.toFixed(2)} ${unidade}`,
        media: `${mediaDiaria.toFixed(2)} ${unidade}/dia`
    });
    
    // Renderizar tabela
    renderizarTabelaConsumo(movimentacoesFiltradas, produtoId);
}


// Renderizar tabela de consumo (sem valor em reais)
function renderizarTabelaConsumo(movimentacoes, produtoId) {
    const tbody = document.getElementById('consumoTableBody');
    if (!tbody) return;
    
    if (movimentacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Nenhum consumo registrado no período</td></tr>';
        return;
    }
    
    // Obter unidade do produto selecionado
    let unidade = 'UN';
    if (produtoId !== 'todos' && typeof produtos !== 'undefined') {
        const produto = produtos.find(p => p.id === produtoId);
        if (produto) {
            unidade = produto.unidade || 'UN';
        }
    }
    
    tbody.innerHTML = movimentacoes.map(mov => {
        const dataFormatada = new Date(mov.dataHora).toLocaleString('pt-BR');
        const produtoNome = mov.produtoNome || mov.produtoId;
        const quantidade = (mov.quantidade || 0).toFixed(2);
        const motivo = mov.motivo === 'inventario' ? '🔢 Baixa por Inventário' : 
                      mov.motivo === 'nota_fiscal' ? '📄 Nota Fiscal' : '✏️ Ajuste Manual';
        
        return `
            <tr>
                <td>${dataFormatada}</td>
                <td><strong>${produtoNome}</strong></td>
                <td>${quantidade}</td>
                <td>${unidade}</td>
                <td>${motivo}</td>
            </tr>
        `;
    }).join('');
}

// Configurar event listeners da tela de consumo
function configurarConsumoListeners() {
    const periodoSelect = document.getElementById('periodoConsumo');
    if (periodoSelect) {
        periodoSelect.addEventListener('change', toggleCamposDataPersonalizada);
    }
    
    const filtrarBtn = document.getElementById('filtrarConsumoBtn');
    if (filtrarBtn) {
        filtrarBtn.addEventListener('click', exibirConsumo);
    }
    
    // Inicializar select de produtos
    popularSelectProdutosConsumo();
}

// Atualizar função inicializarEstoque para incluir consumo
function inicializarEstoqueCompleto() {
    // Chamar funções existentes
    if (typeof inicializarFormularioProduto === 'function') inicializarFormularioProduto();
    if (typeof carregarProdutos === 'function') carregarProdutos();
    if (typeof carregarMovimentacoes === 'function') carregarMovimentacoes();
    if (typeof carregarInventarios === 'function') carregarInventarios();
    
    // Novas funções
    carregarConsumo();
    if (typeof configurarMovimentacoesListeners === 'function') configurarMovimentacoesListeners();
    if (typeof configurarInventarioListeners === 'function') configurarInventarioListeners();
    configurarConsumoListeners();
}

// Substituir a função inicializarEstoque pela nova (se existir)
if (typeof window.inicializarEstoque !== 'undefined') {
    window.inicializarEstoque = inicializarEstoqueCompleto;
} else {
    window.inicializarEstoque = inicializarEstoqueCompleto;
}

console.log('✅ Funções da tela de consumo carregadas!');

// ========== CONFIGURAÇÃO FORÇADA DO BOTÃO CONSUMO ==========
// Aguardar o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Configurando botão de consumo...');
    
    const filtrarConsumoBtn = document.getElementById('filtrarConsumoBtn');
    if (filtrarConsumoBtn) {
        // Remover event listeners antigos
        const novoBtn = filtrarConsumoBtn.cloneNode(true);
        filtrarConsumoBtn.parentNode.replaceChild(novoBtn, filtrarConsumoBtn);
        
        // Adicionar novo event listener
        novoBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Filtrar Consumo CLICADO!');
            if (typeof exibirConsumo === 'function') {
                exibirConsumo();
            } else {
                console.error('Função exibirConsumo não encontrada');
            }
        });
        console.log('✅ Botão Filtrar Consumo configurado permanentemente!');
    } else {
        console.log('❌ Botão filtrarConsumoBtn não encontrado');
    }
    
    // Configurar também o toggle de datas
    const periodoSelect = document.getElementById('periodoConsumo');
    if (periodoSelect) {
        periodoSelect.addEventListener('change', function() {
            console.log('Período alterado para:', this.value);
            const dataInicioGroup = document.getElementById('dataInicioGroup');
            const dataFimGroup = document.getElementById('dataFimGroup');
            if (this.value === 'personalizado') {
                if (dataInicioGroup) dataInicioGroup.style.display = 'block';
                if (dataFimGroup) dataFimGroup.style.display = 'block';
            } else {
                if (dataInicioGroup) dataInicioGroup.style.display = 'none';
                if (dataFimGroup) dataFimGroup.style.display = 'none';
            }
        });
        console.log('✅ Listener do período configurado');
    }
});

// ========== FUNÇÕES DOS RELATÓRIOS ==========

// Gerar relatório
async function gerarRelatorio() {
    const tipo = document.getElementById('tipoRelatorio').value;
    console.log('📊 Gerando relatório:', tipo);
    
    if (tipo === 'estoque') {
        await gerarRelatorioEstoque();
    } else if (tipo === 'consumo') {
        await gerarRelatorioConsumo();
    }
}

async function gerarRelatorioEstoque() {
    console.log('📦 Gerando relatório de estoque...');
    
    if (typeof produtos === 'undefined' || produtos.length === 0) {
        document.getElementById('resultadoRelatorio').innerHTML = '<div class="empty-message">Nenhum produto cadastrado</div>';
        return;
    }
    
    const produtosComEstoque = produtos.map(p => {
        let status = '';
        let statusClass = '';
        const estoqueAtual = p.estoqueAtual || 0;
        const estoqueMinimo = p.estoqueMinimo || 0;
        
        if (estoqueMinimo > 0) {
            if (estoqueAtual <= 0) {
                status = 'ZERADO';
                statusClass = 'status-baixo';
            } else if (estoqueAtual <= estoqueMinimo) {
                status = 'BAIXO';
                statusClass = 'status-baixo';
            } else if (estoqueAtual <= estoqueMinimo * 1.5) {
                status = 'MÉDIO';
                statusClass = 'status-medio';
            } else {
                status = 'ALTO';
                statusClass = 'status-alto';
            }
        } else {
            status = 'SEM MÍNIMO';
            statusClass = 'status-medio';
        }
        
        return {
            ...p,
            status,
            statusClass,
            valorEstoque: (p.estoqueAtual || 0) * (p.precoCusto || 0)
        };
    });
    
    const ordemStatus = { 'ZERADO': 0, 'BAIXO': 1, 'MÉDIO': 2, 'ALTO': 3, 'SEM MÍNIMO': 4 };
    produtosComEstoque.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status]);
    
    const totalProdutos = produtosComEstoque.length;
    const produtosBaixo = produtosComEstoque.filter(p => p.status === 'BAIXO' || p.status === 'ZERADO').length;
    const produtosMedio = produtosComEstoque.filter(p => p.status === 'MÉDIO').length;
    const produtosAlto = produtosComEstoque.filter(p => p.status === 'ALTO').length;
    const valorTotalEstoque = produtosComEstoque.reduce((sum, p) => sum + p.valorEstoque, 0);
    
    // ⭐ ALTERADO: 2 casas decimais ⭐
    const html = `
        <div class="relatorio-titulo">📦 Relatório de Estoque</div>
        <div class="relatorio-subtitulo">Situação atual dos produtos em estoque</div>
        
        <div class="resumo-relatorio">
            <div class="resumo-item">
                <span class="resumo-label">📊 Total de Produtos</span>
                <span class="resumo-valor">${totalProdutos}</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">⚠️ Estoque Baixo/Zerado</span>
                <span class="resumo-valor" style="color: #ef4444;">${produtosBaixo}</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">🟡 Estoque Médio</span>
                <span class="resumo-valor" style="color: #f59e0b;">${produtosMedio}</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">🟢 Estoque Alto</span>
                <span class="resumo-valor" style="color: #10b981;">${produtosAlto}</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">💰 Valor Total Estoque</span>
                <span class="resumo-valor">R$ ${valorTotalEstoque.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="tabela-relatorio">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Produto</th>
                        <th>Estoque Atual</th>
                        <th>Estoque Mínimo</th>
                        <th>Status</th>
                        <th>Valor Estoque</th>
                    </tr>
                </thead>
                <tbody>
                    ${produtosComEstoque.map(p => `
                        <tr>
                            <td>${p.codigo || '-'}</span></td>
                            <td><strong>${p.nome}</strong><br><small>${p.categoria || '-'}</small></td>
                            <td>${(p.estoqueAtual || 0).toFixed(2)} ${p.unidade || 'UN'}</span></td>
                            <td>${(p.estoqueMinimo || 0).toFixed(2)} ${p.unidade || 'UN'}</span></td>
                            <td><span class="${p.statusClass}">${p.status}</span></td>
                            <td>R$ ${p.valorEstoque.toFixed(2)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('resultadoRelatorio').innerHTML = html;
}

async function gerarRelatorioConsumo() {
    console.log('📉 Gerando relatório de consumo...');
    
    const periodo = document.getElementById('periodoRelatorio').value;
    const { dataInicio, dataFim, descricaoPeriodo } = calcularPeriodoRelatorio(periodo);
    
    console.log('Período:', descricaoPeriodo);
    
    if (typeof db === 'undefined') {
        document.getElementById('resultadoRelatorio').innerHTML = '<div class="empty-message">Firebase não disponível</div>';
        return;
    }
    
    const snapshot = await db.collection('movimentacoes').where('tipo', '==', 'saida').get();
    let saidas = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        const dataMov = new Date(data.dataHora);
        if (dataMov >= dataInicio && dataMov <= dataFim) {
            saidas.push(data);
        }
    });
    
    if (saidas.length === 0) {
        document.getElementById('resultadoRelatorio').innerHTML = `
            <div class="relatorio-titulo">📉 Relatório de Consumo</div>
            <div class="empty-message">Nenhum consumo registrado no período ${descricaoPeriodo}</div>
        `;
        return;
    }
    
    const consumoPorProduto = {};
    saidas.forEach(saida => {
        const produtoId = saida.produtoId;
        if (!consumoPorProduto[produtoId]) {
            consumoPorProduto[produtoId] = {
                id: produtoId,
                nome: saida.produtoNome || produtoId,
                quantidade: 0,
                vezesConsumido: 0,
                ultimoConsumo: saida.dataHora
            };
        }
        consumoPorProduto[produtoId].quantidade += saida.quantidade || 0;
        consumoPorProduto[produtoId].vezesConsumido++;
        
        if (new Date(saida.dataHora) > new Date(consumoPorProduto[produtoId].ultimoConsumo)) {
            consumoPorProduto[produtoId].ultimoConsumo = saida.dataHora;
        }
    });
    
    let listaConsumo = Object.values(consumoPorProduto);
    listaConsumo.sort((a, b) => b.quantidade - a.quantidade);
    
    listaConsumo = listaConsumo.map(item => {
        let unidade = 'UN';
        if (typeof produtos !== 'undefined') {
            const produto = produtos.find(p => p.id === item.id);
            if (produto) unidade = produto.unidade || 'UN';
        }
        return { ...item, unidade };
    });
    
    const totalConsumido = listaConsumo.reduce((sum, p) => sum + p.quantidade, 0);
    const totalItensConsumidos = listaConsumo.length;
    const mediaPorItem = totalConsumido / totalItensConsumidos;
    const top3 = listaConsumo.slice(0, 3);
    const topTexto = top3.map((p, i) => `${i+1}º - ${p.nome}: ${p.quantidade.toFixed(2)} ${p.unidade}`).join(' | ');
    
    // ⭐ ALTERADO: 2 casas decimais ⭐
    const html = `
        <div class="relatorio-titulo">📉 Relatório de Consumo</div>
        <div class="relatorio-subtitulo">Período: ${descricaoPeriodo}</div>
        
        <div class="resumo-relatorio">
            <div class="resumo-item">
                <span class="resumo-label">📊 Total Consumido</span>
                <span class="resumo-valor">${totalConsumido.toFixed(2)} unidades</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">📦 Itens Consumidos</span>
                <span class="resumo-valor">${totalItensConsumidos}</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">📈 Média por Item</span>
                <span class="resumo-valor">${mediaPorItem.toFixed(2)} unid.</span>
            </div>
            <div class="resumo-item">
                <span class="resumo-label">🏆 Top 3</span>
                <span class="resumo-valor" style="font-size: 12px;">${topTexto}</span>
            </div>
        </div>
        
        <div class="table-responsive">
            <table class="tabela-relatorio">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Unidade</th>
                        <th>Vezes</th>
                        <th>Média/Uso</th>
                        <th>Último Consumo</th>
                    <tr>
                </thead>
                <tbody>
                    ${listaConsumo.map((p, index) => `
                        <tr>
                            <td><strong>${index + 1}º</strong></td>
                            <td><strong>${p.nome}</strong></td>
                            <td>${p.quantidade.toFixed(2)}</span></td>
                            <td>${p.unidade}</span></td>
                            <td>${p.vezesConsumido} vez(es)</span></td>
                            <td>${(p.quantidade / p.vezesConsumido).toFixed(2)}</span></td>
                            <td>${new Date(p.ultimoConsumo).toLocaleDateString('pt-BR')}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    document.getElementById('resultadoRelatorio').innerHTML = html;
}

// Calcular período do relatório
function calcularPeriodoRelatorio(periodo) {
    const hoje = new Date();
    let dataInicio, dataFim, descricaoPeriodo;
    
    dataFim = new Date(hoje);
    dataFim.setHours(23, 59, 59, 999);
    
    switch(periodo) {
        case 'esteMes':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataInicio.setHours(0, 0, 0, 0);
            descricaoPeriodo = `${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}`;
            break;
        case 'mesPassado':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
            dataInicio.setHours(0, 0, 0, 0);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
            dataFim.setHours(23, 59, 59, 999);
            descricaoPeriodo = `${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}`;
            break;
        case 'ultimos30':
            dataInicio = new Date(hoje);
            dataInicio.setDate(hoje.getDate() - 30);
            dataInicio.setHours(0, 0, 0, 0);
            descricaoPeriodo = `Últimos 30 dias (${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')})`;
            break;
        case 'ultimos90':
            dataInicio = new Date(hoje);
            dataInicio.setDate(hoje.getDate() - 90);
            dataInicio.setHours(0, 0, 0, 0);
            descricaoPeriodo = `Últimos 90 dias (${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')})`;
            break;
        case 'ano':
            dataInicio = new Date(hoje.getFullYear(), 0, 1);
            dataInicio.setHours(0, 0, 0, 0);
            descricaoPeriodo = `Ano de ${hoje.getFullYear()}`;
            break;
        default:
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            descricaoPeriodo = `Este Mês`;
    }
    
    return { dataInicio, dataFim, descricaoPeriodo };
}

// Exportar relatório para Excel - VERSÃO MELHORADA
function exportarRelatorio() {
    const tipo = document.getElementById('tipoRelatorio').value;
    const periodo = document.getElementById('periodoRelatorio')?.value || 'esteMes';
    
    let dadosExcel = [];
    let nomeArquivo = '';
    
    if (tipo === 'estoque') {
        nomeArquivo = `relatorio_estoque_${new Date().toISOString().split('T')[0]}`;
        dadosExcel = gerarDadosExcelEstoque();
    } else {
        nomeArquivo = `relatorio_consumo_${new Date().toISOString().split('T')[0]}`;
        dadosExcel = gerarDadosExcelConsumo(periodo);
    }
    
    if (dadosExcel.length === 0) {
        alert('Nenhum dado para exportar!');
        return;
    }
    
    // Converter para CSV com separador correto
    const csv = dadosExcel.map(row => 
        row.map(cell => {
            // Escapar aspas e tratar valores
            if (cell === null || cell === undefined) return '';
            const cellStr = String(cell);
            return `"${cellStr.replace(/"/g, '""')}"`;
        }).join(',')
    ).join('\n');
    
    // Adicionar BOM para caracteres especiais (acentos)
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${nomeArquivo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    mostrarNotificacao('Relatório exportado com sucesso!', 'success');
}

// Gerar dados para Excel - Relatório de Estoque
function gerarDadosExcelEstoque() {
    const dados = [];
    
    // Cabeçalho principal
    dados.push(['RELATÓRIO DE ESTOQUE']);
    dados.push(['Data de geração:', new Date().toLocaleString('pt-BR')]);
    dados.push([]);
    
    // Cabeçalho da tabela
    dados.push(['CÓDIGO', 'PRODUTO', 'CATEGORIA', 'ESTOQUE ATUAL', 'UNIDADE', 'ESTOQUE MÍNIMO', 'STATUS', 'PREÇO CUSTO', 'VALOR ESTOQUE']);
    
    // Dados
    if (typeof produtos !== 'undefined' && produtos.length > 0) {
        produtos.forEach(produto => {
            const estoqueAtual = produto.estoqueAtual || 0;
            const estoqueMinimo = produto.estoqueMinimo || 0;
            const precoCusto = produto.precoCusto || 0;
            const valorEstoque = estoqueAtual * precoCusto;
            
            let status = '';
            if (estoqueMinimo > 0) {
                if (estoqueAtual <= 0) status = 'ZERADO';
                else if (estoqueAtual <= estoqueMinimo) status = 'BAIXO';
                else if (estoqueAtual <= estoqueMinimo * 1.5) status = 'MÉDIO';
                else status = 'ALTO';
            } else {
                status = 'SEM MÍNIMO';
            }
            
            dados.push([
                produto.codigo || '-',
                produto.nome || '-',
                produto.categoria || '-',
                estoqueAtual.toFixed(3),
                produto.unidade || 'UN',
                estoqueMinimo.toFixed(3),
                status,
                `R$ ${precoCusto.toFixed(3)}`,
                `R$ ${valorEstoque.toFixed(3)}`
            ]);
        });
    }
    
    // Resumo final
    if (dados.length > 3) {
        const totalProdutos = produtos.length;
        const totalValorEstoque = produtos.reduce((sum, p) => sum + ((p.estoqueAtual || 0) * (p.precoCusto || 0)), 0);
        
        dados.push([]);
        dados.push(['RESUMO', '', '', '', '', '', '', '', '']);
        dados.push(['Total de Produtos:', totalProdutos, '', '', '', '', '', '', '']);
        dados.push(['Valor Total do Estoque:', `R$ ${totalValorEstoque.toFixed(3)}`, '', '', '', '', '', '', '']);
    }
    
    return dados;
}

// Gerar dados para Excel - Relatório de Consumo
async function gerarDadosExcelConsumo(periodo) {
    const dados = [];
    const { dataInicio, dataFim, descricaoPeriodo } = calcularPeriodoRelatorio(periodo);
    
    // Cabeçalho principal
    dados.push(['RELATÓRIO DE CONSUMO']);
    dados.push(['Período:', descricaoPeriodo]);
    dados.push(['Data de geração:', new Date().toLocaleString('pt-BR')]);
    dados.push([]);
    
    // Buscar movimentações de saída
    if (typeof db !== 'undefined') {
        const snapshot = await db.collection('movimentacoes').where('tipo', '==', 'saida').get();
        let saidas = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            const dataMov = new Date(data.dataHora);
            if (dataMov >= dataInicio && dataMov <= dataFim) {
                saidas.push(data);
            }
        });
        
        if (saidas.length > 0) {
            // Agrupar por produto
            const consumoPorProduto = {};
            saidas.forEach(saida => {
                const produtoId = saida.produtoId;
                if (!consumoPorProduto[produtoId]) {
                    consumoPorProduto[produtoId] = {
                        nome: saida.produtoNome || produtoId,
                        quantidade: 0,
                        vezesConsumido: 0
                    };
                }
                consumoPorProduto[produtoId].quantidade += saida.quantidade || 0;
                consumoPorProduto[produtoId].vezesConsumido++;
            });
            
            // Converter para array e ordenar
            let listaConsumo = Object.values(consumoPorProduto);
            listaConsumo.sort((a, b) => b.quantidade - a.quantidade);
            
            // Adicionar unidade
            listaConsumo = listaConsumo.map(item => {
                let unidade = 'UN';
                if (typeof produtos !== 'undefined') {
                    const produto = produtos.find(p => p.id === item.id);
                    if (produto) unidade = produto.unidade || 'UN';
                }
                return { ...item, unidade };
            });
            
            // Cabeçalho da tabela
            dados.push(['POSIÇÃO', 'PRODUTO', 'QUANTIDADE CONSUMIDA', 'UNIDADE', 'VEZES CONSUMIDO', 'MÉDIA POR USO']);
            
            // Dados
            listaConsumo.forEach((item, index) => {
                dados.push([
                    `${index + 1}º`,
                    item.nome,
                    item.quantidade.toFixed(3),
                    item.unidade,
                    item.vezesConsumido,
                    (item.quantidade / item.vezesConsumido).toFixed(3)
                ]);
            });
            
            // Resumo final
            const totalConsumido = listaConsumo.reduce((sum, p) => sum + p.quantidade, 0);
            const totalItens = listaConsumo.length;
            
            dados.push([]);
            dados.push(['RESUMO', '', '', '', '', '']);
            dados.push(['Total de itens consumidos:', totalItens]);
            dados.push(['Quantidade total consumida:', `${totalConsumido.toFixed(3)} unidades`]);
            
        } else {
            dados.push(['Nenhum consumo registrado no período selecionado']);
        }
    }
    
    return dados;
}

// Configurar event listeners dos relatórios
function configurarRelatorioListeners() {
    const gerarBtn = document.getElementById('gerarRelatorioBtn');
    if (gerarBtn) {
        const novoBtn = gerarBtn.cloneNode(true);
        gerarBtn.parentNode.replaceChild(novoBtn, gerarBtn);
        novoBtn.addEventListener('click', gerarRelatorio);
    }
    
    const exportarBtn = document.getElementById('exportarRelatorioBtn');
    if (exportarBtn) {
        const novoExportar = exportarBtn.cloneNode(true);
        exportarBtn.parentNode.replaceChild(novoExportar, exportarBtn);
        novoExportar.addEventListener('click', exportarRelatorio);
    }
}

// ========== CONFIGURAÇÃO FORÇADA DOS BOTÕES DE RELATÓRIO ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Configurando botões de relatório...');
    
    // Botão Gerar Relatório
    const gerarBtn = document.getElementById('gerarRelatorioBtn');
    if (gerarBtn) {
        const novoGerar = gerarBtn.cloneNode(true);
        gerarBtn.parentNode.replaceChild(novoGerar, gerarBtn);
        novoGerar.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Gerar Relatório CLICADO!');
            if (typeof gerarRelatorio === 'function') {
                gerarRelatorio();
            } else {
                console.error('Função gerarRelatorio não encontrada');
            }
        });
        console.log('✅ Botão Gerar Relatório configurado');
    } else {
        console.log('❌ Botão gerarRelatorioBtn não encontrado');
    }
    
    // Botão Exportar Relatório
    const exportarBtn = document.getElementById('exportarRelatorioBtn');
    if (exportarBtn) {
        const novoExportar = exportarBtn.cloneNode(true);
        exportarBtn.parentNode.replaceChild(novoExportar, exportarBtn);
        novoExportar.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('👉 Botão Exportar Relatório CLICADO!');
            if (typeof exportarRelatorio === 'function') {
                exportarRelatorio();
            } else {
                console.error('Função exportarRelatorio não encontrada');
            }
        });
        console.log('✅ Botão Exportar Relatório configurado');
    } else {
        console.log('❌ Botão exportarRelatorioBtn não encontrado');
    }
});

// ========== FUNÇÃO DE BUSCA DE PRODUTOS - VERSÃO CORRIGIDA ==========
function configurarBuscaProdutos() {
    console.log('🔧 Configurando busca de produtos...');
    
    const buscaInput = document.getElementById('buscaProduto');
    const limparBtn = document.getElementById('limparBuscaBtn');
    
    if (!buscaInput) {
        console.log('❌ Campo buscaProduto não encontrado');
        return;
    }
    
    // Função que executa a busca - GARANTINDO QUE OS PRODUTOS ESTEJAM CARREGADOS
    async function executarBusca() {
        const termo = buscaInput.value;
        console.log('🔍 Buscando por:', termo);
        
        // ⭐ GARANTIR QUE OS PRODUTOS ESTEJAM CARREGADOS ⭐
        if (!produtos || produtos.length === 0) {
            console.log('⚠️ Produtos não carregados, carregando...');
            if (typeof carregarProdutos === 'function') {
                await carregarProdutos();
            }
        }
        
        // Mostrar/esconder botão limpar
        if (limparBtn) {
            limparBtn.style.display = termo.length > 0 ? 'block' : 'none';
        }
        
        // Renderizar com filtro
        renderizarProdutosComFiltro();
    }
    
    // ⭐ FUNÇÃO DE RENDERIZAÇÃO COM FILTRO ⭐
    window.renderizarProdutosComFiltro = function() {
        const tbody = document.getElementById('produtosTableBody');
        if (!tbody) return;
        
        if (!produtos || produtos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Nenhum produto cadastrado</td></tr>';
            return;
        }
        
        const termoBusca = buscaInput.value.trim().toLowerCase();
        
        let produtosFiltrados = produtos;
        if (termoBusca !== '') {
            produtosFiltrados = produtos.filter(produto => {
                return (produto.codigo && produto.codigo.toLowerCase().includes(termoBusca)) ||
                       (produto.nome && produto.nome.toLowerCase().includes(termoBusca));
            });
            console.log(`🔍 Filtrado: ${produtosFiltrados.length} de ${produtos.length} produtos`);
        }
        
        if (produtosFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-message">🔍 Nenhum produto encontrado com "${termoBusca}"</td></tr>`;
            return;
        }
        
        tbody.innerHTML = produtosFiltrados.map(produto => {
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
            
            const estoqueFormatado = (estoqueAtual).toFixed(3);
            const custoFormatado = (produto.precoCusto || 0).toFixed(2);
            
            // Destacar termo
            let nomeExibido = produto.nome;
            if (termoBusca) {
                const regex = new RegExp(`(${termoBusca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                nomeExibido = produto.nome.replace(regex, '<span class="highlight">$1</span>');
            }
            
            return `
                <tr>
                    <td>${produto.codigo || '-'}</td>
                    <td><strong>${nomeExibido}</strong><br><small>${produto.categoria || '-'}</small></td>
                    <td class="${estoqueClass}">
                        <strong>${estoqueFormatado} ${produto.unidade || 'UN'}</strong>
                        ${alertaTexto ? `<br><small>⚠️ ${alertaTexto}</small>` : ''}
                        ${estoqueMinimo > 0 ? `<br><small style="color: #666;">Mín: ${estoqueMinimo.toFixed(3)} ${produto.unidade || 'UN'}</small>` : ''}
                    </td>
                    <td>R$ ${custoFormatado}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-edit" onclick="editarProduto('${produto.id}')">✏️ Editar</button>
                            <button class="btn-delete" onclick="excluirProduto('${produto.id}')">🗑️ Excluir</button>
                            <button class="btn-primary" style="background: #8b5cf6;" onclick="ajustarEstoque('${produto.id}')">📦 Estoque</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    };
    
    // Evento ao digitar
    buscaInput.addEventListener('input', function() {
        const termo = this.value;
        if (termo.length >= 1 || termo.length === 0) {
            executarBusca();
        }
    });
    
    // Evento ao pressionar Enter
    buscaInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            executarBusca();
        }
    });
    
    // Botão limpar
    if (limparBtn) {
        limparBtn.addEventListener('click', function() {
            buscaInput.value = '';
            this.style.display = 'none';
            executarBusca();
        });
    }
    
    console.log('✅ Busca de produtos configurada');
}

// ========== CONFIGURAÇÃO PERMANENTE DA BUSCA ==========
function configurarBuscaProdutosPermanente() {
    console.log('🔧 Configurando busca permanente...');
    
    const inputBusca = document.getElementById('buscaProduto');
    if (!inputBusca) {
        console.log('❌ Campo buscaProduto não encontrado');
        return;
    }
    
    // Função de busca
    function buscarAgora() {
        const termo = inputBusca.value.trim().toLowerCase();
        console.log('🔍 Buscando por:', termo || '(todos)');
        
        let filtrados = produtos;
        if (termo) {
            filtrados = produtos.filter(p => 
                (p.codigo && p.codigo.toLowerCase().includes(termo)) ||
                (p.nome && p.nome.toLowerCase().includes(termo))
            );
        }
        
        const tbody = document.getElementById('produtosTableBody');
        if (!tbody) return;
        
        if (filtrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-message">🔍 Nenhum produto encontrado${termo ? ' para "' + termo + '"' : ''}</td></tr>`;
            return;
        }
        
        tbody.innerHTML = filtrados.map(p => `
            <tr>
                <td>${p.codigo || '-'}</td>
                <td><strong>${p.nome || '-'}</strong><br><small>${p.categoria || '-'}</small></td>
                <td>${(p.estoqueAtual || 0).toFixed(3)} ${p.unidade || 'UN'}</td>
                <td>R$ ${(p.precoCusto || 0).toFixed(2)}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-edit" onclick="editarProduto('${p.id}')">✏️ Editar</button>
                        <button class="btn-delete" onclick="excluirProduto('${p.id}')">🗑️ Excluir</button>
                        <button class="btn-primary" onclick="ajustarEstoque('${p.id}')">📦 Estoque</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Configurar eventos
    inputBusca.addEventListener('input', buscarAgora);
    inputBusca.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') buscarAgora();
    });
    
    // Configurar botão limpar se existir
    const limparBtn = document.getElementById('limparBuscaBtn');
    if (limparBtn) {
        limparBtn.addEventListener('click', function() {
            inputBusca.value = '';
            buscarAgora();
        });
    }
    
    console.log('✅ Busca permanente configurada!');
}

// Chamar a função quando a página carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configurarBuscaProdutosPermanente);
} else {
    configurarBuscaProdutosPermanente();
}

// ========== CÓDIGO AUTOMÁTICO PARA PRODUTOS ==========

// Função para gerar próximo código
async function gerarProximoCodigo() {
    if (typeof db === 'undefined') return '001';
    
    try {
        // Buscar produtos ordenados por código
        const snapshot = await db.collection('produtos')
            .orderBy('codigo', 'desc')
            .limit(1)
            .get();
        
        let ultimoCodigo = 0;
        
        if (!snapshot.empty) {
            const ultimoProduto = snapshot.docs[0].data();
            const codigoStr = ultimoProduto.codigo;
            const numero = parseInt(codigoStr, 10);
            if (!isNaN(numero)) {
                ultimoCodigo = numero;
            }
        }
        
        const proximoCodigo = ultimoCodigo + 1;
        const codigoFormatado = proximoCodigo.toString().padStart(3, '0');
        
        console.log(`📝 Novo código gerado: ${codigoFormatado}`);
        return codigoFormatado;
        
    } catch (error) {
        console.error('Erro ao gerar código:', error);
        return '001';
    }
}

// Função para atualizar o campo de código
async function atualizarCampoCodigo() {
    const campoCodigo = document.getElementById('produtoCodigo');
    if (campoCodigo) {
        const novoCodigo = await gerarProximoCodigo();
        campoCodigo.value = novoCodigo;
        campoCodigo.readOnly = true;
        campoCodigo.style.backgroundColor = '#f1f5f9';
        campoCodigo.style.fontWeight = 'bold';
        console.log(`✅ Código atualizado: ${novoCodigo}`);
    }
}

// Modificar o botão de cadastro para preservar o código
function configurarCadastroComCodigo() {
    const btnSalvar = document.getElementById('salvarProdutoBtn');
    if (!btnSalvar) {
        console.log('Botão não encontrado');
        return;
    }
    
    // Adicionar evento para garantir o código antes de salvar
    btnSalvar.addEventListener('click', async function(e) {
        const campoCodigo = document.getElementById('produtoCodigo');
        if (campoCodigo && !campoCodigo.value) {
            campoCodigo.value = await gerarProximoCodigo();
        }
    });
    
    console.log('✅ Configuração de código automática ativada');
}

// Inicializar quando a página de estoque for aberta
function inicializarCodigoAutomatico() {
    console.log('🔧 Inicializando código automático...');
    atualizarCampoCodigo();
    configurarCadastroComCodigo();
}

// Chamar quando o DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(inicializarCodigoAutomatico, 1000);
    });
} else {
    setTimeout(inicializarCodigoAutomatico, 1000);
}

// Executar também quando a página de estoque for aberta
const observerCodigo = new MutationObserver(function() {
    const estoquePage = document.getElementById('estoquePage');
    if (estoquePage && estoquePage.style.display === 'block') {
        console.log('📦 Estoque aberto, atualizando código...');
        atualizarCampoCodigo();
    }
});

const paginaEstoque = document.getElementById('estoquePage');
if (paginaEstoque) {
    observerCodigo.observe(paginaEstoque, { attributes: true });
}

console.log('🚀 Script de código automático carregado!');