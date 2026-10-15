# Relógio Turquesa

Relógio analógico em HTML, CSS, JavaScript e SVG inline. Fundo contínuo turquesa,
algarismos vetoriais próprios, escala verde-água e ponteiros com acabamento prateado.
Não usa imagens, fontes externas, bibliotecas de interface ou serviços remotos.

## Executar

Na pasta do projeto, com Python 3 disponível:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

O servidor atende na porta 8000 da máquina local. Também é possível usar qualquer
servidor estático que sirva módulos JavaScript com o tipo MIME correto.
Não há instalação de pacotes nem compilação para executar o site. O ambiente de
onboarding não oferece uma prévia web; a validação nele usa requisições locais.

Por padrão, o relógio mostra a hora local **do dispositivo que abre a página**.
Ele não consulta um servidor de horário. Use um navegador moderno com suporte a
módulos JavaScript, SVG e variáveis CSS.

## Comparação e configuração

Acrescente à URL da página:

- `?reference` — pausa em **09:30:08**.
- `?reference=03:15:00` — pausa em um horário específico.
- `?reference=09:30:59.999` — também aceita frações de segundo.

O formato é `HH:MM:SS`, opcionalmente com 1–3 casas decimais, entre 00:00:00 e
23:59:59.999. Valores inválidos retornam ao horário local e geram um aviso no console.
Remova o parâmetro para voltar ao movimento normal. As opções não ocupam o mostrador.

- **`styles.css`**: paleta nas variáveis `--background`, `--hour-ink`, `--scale-ink`,
  `--silver`, `--inlay` e demais cores de material.
- **`clock-face.js`**: `CLOCK_CONFIG` concentra raios, larguras, comprimentos,
  sombras e referência padrão. A geometria usa `viewBox="0 0 1000 1000"`.
- **`clock-time.js`**: cálculo dos ângulos, leitura da hora local e interpretação
  do modo de referência.
- **`clock.js`**: animação e ciclo de vida. `mountClock()` retorna uma função de
  limpeza para uma eventual integração em outro componente.

As sombras ficam em grupos externos sem rotação; a geometria dos ponteiros gira
internamente. O brilho dos chanfros é ponderado pela orientação em relação a uma
luz no alto à esquerda. Esse material é uma aproximação vetorial, sem simulação 3D.

O movimento usa um único `requestAnimationFrame`, calculado a partir do relógio
do sistema. Com movimento reduzido, usa um timer alinhado ao segundo. Abas ocultas
suspendem a atualização; ao retornar, a hora é consultada novamente. O horário
textual fica acessível sem anúncios automáticos a cada segundo.

## Verificação

Testes de horário, sem pacotes adicionais (Node.js 18 ou superior):

```sh
npm test
```

Teste opcional no Chromium, com o servidor já iniciado:

```sh
npm install --no-save --package-lock=false playwright@1.58.2
npx playwright install chromium
npm run test:browser
```

Se o Chromium já estiver instalado, dispense seu download e defina
`CHROMIUM_PATH` com o caminho do executável. `PLAYWRIGHT_MODULE` permite indicar
uma instalação externa do Playwright; `CLOCK_URL` seleciona o servidor de teste;
`ARTIFACTS_DIR` muda o diretório das capturas (padrão: `/tmp/relogio-checks`).

Foram executados quatro testes de horário e nove verificações de navegador:
marcações e orientação dos números; horários fixos; margens e proporções em
1440×1000, 320×568 e 844×390; direção das sombras rasterizadas em quatro ângulos;
hora local e virada de minuto; ocultação e retorno da aba por evento simulado;
movimento reduzido e troca de preferência; parâmetros inválidos; ausência de
erros JavaScript. As capturas de desktop e celular também foram inspecionadas.

No Chromium headless desta máquina, uma amostra de 120 intervalos levou cerca
de 2 s, com mediana de 16,7 ms. Não é garantia de desempenho em outros dispositivos.
A validação de acessibilidade cobriu a estrutura e o texto no DOM, sem um leitor
de tela real. Outros motores de navegador não foram testados.

**Limitação da referência:** o vídeo `I6JT6iwqxbA8vVg8.mp4` não estava nos anexos
recebidos. A implementação segue a descrição, a paleta e as medidas fornecidas;
não foi possível comparar com os quadros do vídeo ou atestar fidelidade a eles.

Documentação de apoio consultada no conteúdo oficial da MDN:
[requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame),
[gradientUnits](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/gradientUnits) e
[feDropShadow](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDropShadow).
