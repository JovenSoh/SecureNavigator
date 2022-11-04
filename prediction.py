import numpy as np
import tensorflow as tf
from tensorflow import keras
import sys

def encoder_input_text(input_text,num_encoder_tokens,max_encoder_seq_length,input_token_index):
  encoder_input_data_test = np.zeros(
      (1, max_encoder_seq_length, num_encoder_tokens), dtype="float32"
  )

  for t, char in enumerate(input_text):
      encoder_input_data_test[0, t, input_token_index[char]] = 1.0
  encoder_input_data_test[0, t + 1 :, input_token_index[" "]] = 1.0

  return encoder_input_data_test[0:1]

def load_encoder_decoder(latent_dim,num_encoder_tokens,num_decoder_tokens):
  # Define an input sequence and process it.
  encoder_inputs = keras.Input(shape=(None, num_encoder_tokens))
  encoder = keras.layers.LSTM(latent_dim, return_state=True)
  encoder_outputs, state_h, state_c = encoder(encoder_inputs)
  # We discard `encoder_outputs` and only keep the states.
  encoder_states = [state_h, state_c]

  # Set up the decoder, using `encoder_states` as initial state.
  decoder_inputs = keras.Input(shape=(None, num_decoder_tokens))

  # We set up our decoder to return full output sequences,
  # and to return internal states as well. We don't use the
  # return states in the training model, but we will use them in inference.
  decoder_lstm = keras.layers.LSTM(latent_dim, return_sequences=True, return_state=True)
  decoder_outputs, _, _ = decoder_lstm(decoder_inputs, initial_state=encoder_states)
  decoder_dense = keras.layers.Dense(num_decoder_tokens, activation="softmax")
  decoder_outputs = decoder_dense(decoder_outputs)

def load_model(latent_dim,input_token_index,target_token_index):
  # Define sampling models
  # Restore the model and construct the encoder and decoder.
  model = keras.models.load_model("s2s")
  
  encoder_inputs = model.input[0]  # input_1
  encoder_outputs, state_h_enc, state_c_enc = model.layers[2].output  # lstm_1
  encoder_states = [state_h_enc, state_c_enc]
  encoder_model = keras.Model(encoder_inputs, encoder_states)

  decoder_inputs = model.input[1]  # input_2
  decoder_state_input_h = keras.Input(shape=(latent_dim,))
  decoder_state_input_c = keras.Input(shape=(latent_dim,))
  decoder_states_inputs = [decoder_state_input_h, decoder_state_input_c]
  decoder_lstm = model.layers[3]
  decoder_outputs, state_h_dec, state_c_dec = decoder_lstm(
      decoder_inputs, initial_state=decoder_states_inputs
  )
  decoder_states = [state_h_dec, state_c_dec]
  decoder_dense = model.layers[4]
  decoder_outputs = decoder_dense(decoder_outputs)
  decoder_model = keras.Model(
      [decoder_inputs] + decoder_states_inputs, [decoder_outputs] + decoder_states
  )

  # Reverse-lookup token index to decode sequences back to
  # something readable.
  reverse_input_char_index = dict((i, char) for char, i in input_token_index.items())
  reverse_target_char_index = dict((i, char) for char, i in target_token_index.items())

  return encoder_model, decoder_model, reverse_target_char_index


def decode_sequence(input_seq,encoder_model, decoder_model,num_decoder_tokens,max_decoder_seq_length,target_token_index,reverse_target_char_index):
    # Encode the input as state vectors.
    states_value = encoder_model.predict(input_seq, verbose=False)

    # Generate empty target sequence of length 1.
    target_seq = np.zeros((1, 1, num_decoder_tokens))
    # Populate the first character of target sequence with the start character.
    target_seq[0, 0, target_token_index["\t"]] = 1.0

    # Sampling loop for a batch of sequences
    # (to simplify, here we assume a batch of size 1).
    stop_condition = False
    decoded_sentence = ""
    while not stop_condition:
        output_tokens, h, c = decoder_model.predict([target_seq] + states_value, verbose=False)

        # Sample a token
        sampled_token_index = np.argmax(output_tokens[0, -1, :])
        sampled_char = reverse_target_char_index[sampled_token_index]
        decoded_sentence += sampled_char

        # Exit condition: either hit max length
        # or find stop character.
        if sampled_char == "\n" or len(decoded_sentence) > max_decoder_seq_length:
            stop_condition = True

        # Update the target sequence (of length 1).
        target_seq = np.zeros((1, 1, num_decoder_tokens))
        target_seq[0, 0, sampled_token_index] = 1.0

        # Update states
        states_value = [h, c]
    return decoded_sentence

def text_preprocessing(input_text):
  with open('entities.txt') as f:
    entities = f.read().splitlines() 
    # using findall() to neglect unicode of Non-English alphabets
    entities = list(filter(lambda ele: ele.isalpha(), entities))
    #remove duplicates
    entities = [*set(entities)]

  input_text = input_text.replace("'"," ").split()

  found_entities = []
  for keyWord in entities:
      if keyWord in input_text:
          found_entities.append([input_text.index(keyWord),keyWord])

  return found_entities


def text_postprocessing(decoded_sentence,found_entities):
  found_entities.sort()

  while len(found_entities) > 0:
    decoded_sentence = decoded_sentence.replace("{}",found_entities[0][1],1)
    found_entities.pop(0)

  return decoded_sentence

def main(input_text):

  found_entities = text_preprocessing(input_text)
  #Output
  input_seq = encoder_input_text(input_text,num_encoder_tokens,max_encoder_seq_length,input_token_index)
  decoded_sentence = decode_sequence(input_seq,encoder_model,decoder_model,num_decoder_tokens,max_decoder_seq_length,target_token_index,reverse_target_char_index)

  final_output = text_postprocessing(decoded_sentence,found_entities)

  return final_output

"""Number of unique input tokens: 60 <br>
Number of unique output tokens: 35 <br>
Max sequence length for inputs: 131 <br>
Max sequence length for outputs: 61 <br>
"""

#Save states
latent_dim = 256  # Latent dimensionality of the encoding space.

num_encoder_tokens = 60
num_decoder_tokens = 35
max_encoder_seq_length = 131
max_decoder_seq_length = 61

#retrieve token indexes
import json
with open('input_token_index.json', 'r') as fp:
    input_token_index = json.load(fp)
with open('target_token_index.json', 'r') as fp:
    target_token_index = json.load(fp)

#load necessary models
load_encoder_decoder(latent_dim,num_encoder_tokens,num_decoder_tokens)
encoder_model, decoder_model, reverse_target_char_index = load_model(latent_dim,input_token_index,target_token_index)

output_text = main(sys.argv[1])

print(output_text)