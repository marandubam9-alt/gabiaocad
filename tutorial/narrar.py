"""Gera a narração do vídeo tutorial (uma faixa por fala do roteiro) com a voz pt_BR 'faber' do Piper (licença MIT, dados CC0).
Uso: python tutorial/narrar.py <modelo.onnx> <pasta_saida>"""
import json, os, sys, wave
from piper import PiperVoice
from piper.config import SynthesisConfig
modelo, saida = sys.argv[1], sys.argv[2]
os.makedirs(saida, exist_ok=True)
voz = PiperVoice.load(modelo)
cfg = SynthesisConfig(length_scale=1.08, noise_scale=0.6, noise_w_scale=0.8)
roteiro = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'roteiro.json'), encoding='utf-8'))
for cena in roteiro:
    with wave.open(os.path.join(saida, cena['id'] + '.wav'), 'wb') as w:
        voz.synthesize_wav(cena['fala'], w, syn_config=cfg)
    print(cena['id'], 'ok')
